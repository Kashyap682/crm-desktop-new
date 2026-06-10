package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// ============================================================
//  CONFIG
// ============================================================

type config struct {
	dbURL          string
	jwtSecret      []byte
	accessTokenTTL time.Duration
	refreshTokenTTL time.Duration
	port           string
}

func loadConfig() config {
	secret := os.Getenv("JWT_SECRET")
	if len(secret) < 32 {
		log.Fatal("JWT_SECRET must be at least 32 characters")
	}

	return config{
		dbURL:           os.Getenv("DATABASE_URL"),
		jwtSecret:       []byte(secret),
		accessTokenTTL:  15 * time.Minute,
		refreshTokenTTL: 7 * 24 * time.Hour,
		port:            envOr("AUTH_PORT", "8001"),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ============================================================
//  RATE LIMITER  (5 attempts / IP / minute)
// ============================================================

type rateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
}

func newRateLimiter() *rateLimiter {
	rl := &rateLimiter{attempts: make(map[string][]time.Time)}
	// Clean up old entries every 5 minutes
	go func() {
		for range time.Tick(5 * time.Minute) {
			rl.mu.Lock()
			cutoff := time.Now().Add(-time.Minute)
			for ip, times := range rl.attempts {
				var recent []time.Time
				for _, t := range times {
					if t.After(cutoff) {
						recent = append(recent, t)
					}
				}
				if len(recent) == 0 {
					delete(rl.attempts, ip)
				} else {
					rl.attempts[ip] = recent
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-time.Minute)

	var recent []time.Time
	for _, t := range rl.attempts[ip] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}

	if len(recent) >= 5 {
		rl.attempts[ip] = recent
		return false
	}

	rl.attempts[ip] = append(recent, now)
	return true
}

// ============================================================
//  JWT
// ============================================================

type claims struct {
	jwt.RegisteredClaims
	Email   string `json:"email"`
	Role    string `json:"role"`     // postgres role — PostgREST uses this
	OrgID   string `json:"org_id"`
	AppRole string `json:"app_role"` // admin / sales / viewer — for RLS later
	UserID  string `json:"user_id"`
}

func (cfg config) generateAccessToken(userID, email, orgID, appRole string) (string, error) {
	now := time.Now()
	c := claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(cfg.accessTokenTTL)),
		},
		Email:   email,
		Role:    "authenticated", // postgres role PostgREST switches to
		OrgID:   orgID,
		AppRole: appRole,
		UserID:  userID,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
	return token.SignedString(cfg.jwtSecret)
}

func (cfg config) verifyAccessToken(tokenStr string) (*claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return cfg.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	c, ok := token.Claims.(*claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return c, nil
}

// ============================================================
//  REFRESH TOKEN  (random 32 bytes, stored as SHA-256 hash)
// ============================================================

func generateRefreshToken() (plain, hashed string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	plain = hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(plain))
	hashed = hex.EncodeToString(sum[:])
	return
}

func hashRefreshToken(plain string) string {
	sum := sha256.Sum256([]byte(plain))
	return hex.EncodeToString(sum[:])
}

// ============================================================
//  SERVER
// ============================================================

type server struct {
	cfg config
	db  *pgxpool.Pool
	rl  *rateLimiter
}

func main() {
	cfg := loadConfig()

	ctx := context.Background()
	db, err := pgxpool.New(ctx, cfg.dbURL)
	if err != nil {
		log.Fatalf("cannot connect to database: %v", err)
	}
	defer db.Close()

	if err = db.Ping(ctx); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}
	log.Println("connected to database")

	s := &server{cfg: cfg, db: db, rl: newRateLimiter()}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /auth/register", s.handleRegister)
	mux.HandleFunc("POST /auth/login",    s.handleLogin)
	mux.HandleFunc("POST /auth/refresh",  s.handleRefresh)
	mux.HandleFunc("POST /auth/logout",   s.handleLogout)
	mux.HandleFunc("GET /auth/me",        s.handleMe)

	handler := corsMiddleware(mux)

	addr := ":" + cfg.port
	log.Printf("auth service listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// ============================================================
//  CORS MIDDLEWARE
// ============================================================

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ============================================================
//  HELPERS
// ============================================================

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func realIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	// Strip port from RemoteAddr
	addr := r.RemoteAddr
	if i := strings.LastIndex(addr, ":"); i != -1 {
		return addr[:i]
	}
	return addr
}

// ============================================================
//  POST /auth/register
// ============================================================

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	AppRole  string `json:"app_role"` // admin / sales / viewer
	OrgID    string `json:"org_id"`
}

func (s *server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if req.AppRole == "" {
		req.AppRole = "sales"
	}
	validRoles := map[string]bool{"admin": true, "sales": true, "viewer": true}
	if !validRoles[req.AppRole] {
		writeError(w, http.StatusBadRequest, "app_role must be admin, sales, or viewer")
		return
	}
	if req.OrgID == "" {
		req.OrgID = "00000000-0000-0000-0000-000000000001" // default org
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		log.Printf("bcrypt error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	// Insert user
	var userID string
	err = s.db.QueryRow(r.Context(),
		`INSERT INTO auth_users (org_id, email, password_hash, app_role)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		req.OrgID, req.Email, string(hash), req.AppRole,
	).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			writeError(w, http.StatusConflict, "email already registered")
			return
		}
		log.Printf("insert user error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"id":    userID,
		"email": req.Email,
	})
}

// ============================================================
//  POST /auth/login
// ============================================================

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"` // seconds
}

func (s *server) handleLogin(w http.ResponseWriter, r *http.Request) {
	// Rate limit
	ip := realIP(r)
	if !s.rl.allow(ip) {
		writeError(w, http.StatusTooManyRequests, "too many login attempts, please wait a minute")
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	// Fetch user — always run bcrypt even if not found to prevent timing attacks
	var (
		userID, orgID, appRole, passwordHash string
		isActive                              bool
	)
	err := s.db.QueryRow(r.Context(),
		`SELECT id, org_id, app_role, password_hash, is_active
		 FROM auth_users WHERE email = $1`,
		req.Email,
	).Scan(&userID, &orgID, &appRole, &passwordHash, &isActive)

	userNotFound := err != nil

	// Always compare to prevent timing attacks — use a dummy hash if user not found
	compareHash := passwordHash
	if userNotFound {
		compareHash = "$2a$12$dummy.hash.to.prevent.timing.attacks.padding.padding.pa"
	}

	bcryptErr := bcrypt.CompareHashAndPassword([]byte(compareHash), []byte(req.Password))

	if userNotFound || bcryptErr != nil || !isActive {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	// Generate tokens
	accessToken, err := s.cfg.generateAccessToken(userID, req.Email, orgID, appRole)
	if err != nil {
		log.Printf("token generation error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	plain, hashed, err := generateRefreshToken()
	if err != nil {
		log.Printf("refresh token generation error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	// Store refresh token
	_, err = s.db.Exec(r.Context(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)`,
		userID, hashed, time.Now().Add(s.cfg.refreshTokenTTL),
	)
	if err != nil {
		log.Printf("refresh token store error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{
		AccessToken:  accessToken,
		RefreshToken: plain,
		ExpiresIn:    int(s.cfg.accessTokenTTL.Seconds()),
	})
}

// ============================================================
//  POST /auth/refresh
// ============================================================

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (s *server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	hashed := hashRefreshToken(req.RefreshToken)

	// Look up token, join user details
	var (
		tokenID, userID, email, orgID, appRole string
		expiresAt                               time.Time
		isActive                                bool
	)
	err := s.db.QueryRow(r.Context(),
		`SELECT rt.id, u.id, u.email, u.org_id, u.app_role, rt.expires_at, u.is_active
		 FROM refresh_tokens rt
		 JOIN auth_users u ON u.id = rt.user_id
		 WHERE rt.token_hash = $1`,
		hashed,
	).Scan(&tokenID, &userID, &email, &orgID, &appRole, &expiresAt, &isActive)

	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}
	if time.Now().After(expiresAt) || !isActive {
		writeError(w, http.StatusUnauthorized, "invalid or expired refresh token")
		return
	}

	// Rotate — delete old token, issue new pair
	_, err = s.db.Exec(r.Context(),
		`DELETE FROM refresh_tokens WHERE id = $1`, tokenID,
	)
	if err != nil {
		log.Printf("delete refresh token error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	accessToken, err := s.cfg.generateAccessToken(userID, email, orgID, appRole)
	if err != nil {
		log.Printf("token generation error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	plain, hashed, err := generateRefreshToken()
	if err != nil {
		log.Printf("refresh token generation error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	_, err = s.db.Exec(r.Context(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)`,
		userID, hashed, time.Now().Add(s.cfg.refreshTokenTTL),
	)
	if err != nil {
		log.Printf("refresh token store error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{
		AccessToken:  accessToken,
		RefreshToken: plain,
		ExpiresIn:    int(s.cfg.accessTokenTTL.Seconds()),
	})
}

// ============================================================
//  POST /auth/logout
// ============================================================

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (s *server) handleLogout(w http.ResponseWriter, r *http.Request) {
	var req logoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	hashed := hashRefreshToken(req.RefreshToken)
	s.db.Exec(r.Context(), `DELETE FROM refresh_tokens WHERE token_hash = $1`, hashed)

	// Always return 200 — don't reveal whether the token existed
	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// ============================================================
//  GET /auth/me
// ============================================================

func (s *server) handleMe(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		writeError(w, http.StatusUnauthorized, "missing or malformed Authorization header")
		return
	}

	c, err := s.cfg.verifyAccessToken(strings.TrimPrefix(authHeader, "Bearer "))
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"user_id":  c.UserID,
		"email":    c.Email,
		"org_id":   c.OrgID,
		"app_role": c.AppRole,
	})
}

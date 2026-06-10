FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy source and tidy (generates go.sum)
COPY . .
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o auth-service .

# Final image — scratch works because the binary is fully static (CGO_ENABLED=0)
FROM scratch

COPY --from=builder /app/auth-service /auth-service

EXPOSE 8001
CMD ["/auth-service"]

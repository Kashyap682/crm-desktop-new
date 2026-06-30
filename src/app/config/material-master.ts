/**
 * Material Master Config
 *
 * Single source of truth for all materials, their makes, form options,
 * and the specification fields that should appear in Inquiry / Offer / Inventory
 * when that material is selected.
 *
 * specFields  — shown when the product is area-based (slab, roll, board, sheet)
 * pipeFields  — shown instead when the form value is in pipeFormValues
 *               (pipe sections, tubing — NB/OD replaces width/length)
 */

export type FieldType = 'select' | 'text' | 'number';

export interface FieldDef {
  key: string;        // stored in item.specs[key]
  label: string;      // shown to user
  type: FieldType;
  options?: string[]; // dropdown values
  unit?: string;      // display hint, e.g. 'mm', 'kg/m³'
}

export type MaterialCategory =
  | 'Insulation'
  | 'Cladding'
  | 'Roofing'
  | 'Accessories'
  | 'Films & Foils';

export interface MaterialDef {
  id: string;
  name: string;
  category: MaterialCategory;
  makes: string[];
  forms: string[];            // form options (first is default)
  defaultUom: string;         // suggested UOM for inquiry qty
  specFields: FieldDef[];     // fields for area/slab/roll/sheet forms
  pipeFields?: FieldDef[];    // fields shown instead for pipe/tubing forms
  pipeFormValues?: string[];  // which form values trigger pipeFields
}

// ─── Shared field definitions (reused across materials) ──────────────────────

const DENSITY_ROCKWOOL: FieldDef = {
  key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
  options: ['48', '64', '70', '80', '90', '100', '120', '128', '150'],
};

const DENSITY_FIBERGLASS: FieldDef = {
  key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
  options: ['10', '16', '20', '24', '32', '40', '48'],
};

const DENSITY_CERAMIC: FieldDef = {
  key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
  options: ['64', '96', '128', '160'],
};

const THICKNESS_INSULATION: FieldDef = {
  key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
  options: ['13', '25', '40', '50', '65', '75', '100', '125', '150'],
};

const THICKNESS_XLPE: FieldDef = {
  key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
  options: ['3', '4', '5', '6', '8', '9', '10', '12', '13', '15', '18', '19', '20', '24', '25', '30', '32', '35', '40', '50'],
};

const WIDTH_M: FieldDef = {
  key: 'width', label: 'Width', type: 'text', unit: 'm',
};

const LENGTH_M: FieldDef = {
  key: 'length', label: 'Length', type: 'text', unit: 'm',
};

const WIDTH_MM: FieldDef = {
  key: 'width', label: 'Width', type: 'number', unit: 'mm',
};

const LENGTH_MM: FieldDef = {
  key: 'length', label: 'Length', type: 'number', unit: 'mm',
};

const NB: FieldDef = {
  key: 'nb', label: 'NB', type: 'select', unit: 'inch',
  options: [
    '½"', '¾"', '1"', '1¼"', '1½"', '2"', '2½"', '3"', '4"',
    '5"', '6"', '8"', '10"', '12"', '14"', '16"', '18"', '20"', '24"',
  ],
};

const OD: FieldDef = {
  key: 'od', label: 'OD', type: 'number', unit: 'mm',
};

const THICKNESS_PIPE: FieldDef = {
  key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
  options: ['25', '40', '50', '65', '75', '100'],
};

const LENGTH_PIPE: FieldDef = {
  key: 'length', label: 'Length', type: 'select', unit: 'm',
  options: ['0.5', '1', '1.5', '2', '3'],
};

// ─── Insulation ──────────────────────────────────────────────────────────────

const ROCKWOOL_AREA_FIELDS: FieldDef[] = [
  DENSITY_ROCKWOOL,
  THICKNESS_INSULATION,
  WIDTH_M,
  LENGTH_M,
  {
    key: 'facings', label: 'Facings', type: 'select',
    options: ['Unfaced', 'GI Wire Mesh', 'SS Wire Mesh', 'FSK', 'Aluglass', 'BGT', 'AluGlass'],
  },
];

const ROCKWOOL_PIPE_FIELDS: FieldDef[] = [
  NB, OD, THICKNESS_PIPE, LENGTH_PIPE,
  {
    key: 'facings', label: 'Facing', type: 'select',
    options: ['Unfaced', 'Aluminium Foil', 'GI Wire Mesh', 'SS Wire Mesh'],
  },
];

const FIBERGLASS_AREA_FIELDS: FieldDef[] = [
  DENSITY_FIBERGLASS,
  THICKNESS_INSULATION,
  WIDTH_M,
  LENGTH_M,
  {
    key: 'facings', label: 'Facings', type: 'select',
    options: [
      'Unfaced', 'FSK', 'FRK', 'Aluglass', 'Alu Foil Facing', 'R3035HD',
      'ASJ (All Service Jacket)', 'FGT', 'BGT', 'WGC', 'BGC',
      'Black Tissue', 'White Polypropylene', 'Kraft Paper',
    ],
  },
  {
    key: 'flange', label: 'Flange', type: 'select',
    options: ['With Flange', 'Without Flange'],
  },
];

const FIBERGLASS_PIPE_FIELDS: FieldDef[] = [
  NB, OD,
  { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
    options: ['25', '40', '50', '65', '75', '100'] },
  LENGTH_PIPE,
  {
    key: 'facings', label: 'Facing', type: 'select',
    options: ['Unfaced', 'FSK', 'Aluglass', 'Alu Foil', 'BGT', 'ASJ', 'Kraft Paper'],
  },
];

const PUF_AREA_FIELDS: FieldDef[] = [
  { key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
    options: ['30', '35', '40', '48', '56', '64'] },
  { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
    options: ['25', '40', '50', '65', '75', '100'] },
  WIDTH_MM,
  LENGTH_MM,
  {
    key: 'facing', label: 'Facing', type: 'select',
    options: ['Plain', 'Aluminium Foil', 'Glass Tissue', 'Alu Glass', 'Kraft Paper'],
  },
];

const PUF_PIPE_FIELDS: FieldDef[] = [
  { key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
    options: ['30', '35', '40', '48', '56', '64'] },
  NB, OD,
  { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
    options: ['25', '40', '50', '65', '75', '100'] },
  LENGTH_PIPE,
  {
    key: 'facing', label: 'Facing', type: 'select',
    options: ['Plain', 'Aluminium Foil', 'Glass Tissue', 'Alu Glass'],
  },
];

// ─── Material Definitions ────────────────────────────────────────────────────

export const MATERIAL_MASTER: MaterialDef[] = [

  // ── Insulation ─────────────────────────────────────────────────────────────

  {
    id: 'rockwool',
    name: 'Rockwool',
    category: 'Insulation',
    makes: ['Roxul', 'SGIPL (Saint Gobain)', 'Isover'],
    forms: ['Slab', 'Mattress (Roll)', 'Mattress (Sheet)', 'Building Roll', 'Pipe Section', 'TuffInsul Slab', 'Lamella Batt'],
    defaultUom: 'SQM',
    specFields: ROCKWOOL_AREA_FIELDS,
    pipeFields: ROCKWOOL_PIPE_FIELDS,
    pipeFormValues: ['Pipe Section'],
  },

  {
    id: 'fiberglass',
    name: 'Fiberglass',
    category: 'Insulation',
    makes: ['SGIPL (Saint Gobain)', 'Owens Corning', 'Isover'],
    forms: ['Roll', 'Board', 'Slab', 'Wired Mattress', 'Pipe Section'],
    defaultUom: 'SQM',
    specFields: FIBERGLASS_AREA_FIELDS,
    pipeFields: FIBERGLASS_PIPE_FIELDS,
    pipeFormValues: ['Pipe Section'],
  },

  {
    id: 'xlpe',
    name: 'XLPE',
    category: 'Insulation',
    makes: ['Narendra Flexi Pack', 'Aeroflex', 'K-FLEX'],
    forms: ['Roll', 'Slab', 'Tubing'],
    defaultUom: 'SQM',
    specFields: [
      THICKNESS_XLPE,
      { key: 'width', label: 'Width', type: 'select', unit: 'm', options: ['1.2'] },
      LENGTH_M,
      {
        key: 'facings', label: 'Facings', type: 'select',
        options: ['Aluminium', 'Alupet', 'Unfaced'],
      },
      {
        key: 'class', label: 'Class', type: 'select',
        options: ['O (Open Cell)', 'C (Closed Cell)'],
      },
    ],
    pipeFields: [
      NB, OD, THICKNESS_XLPE, LENGTH_PIPE,
      {
        key: 'facings', label: 'Facing', type: 'select',
        options: ['Aluminium', 'Alupet', 'Unfaced', 'Self Adhesive'],
      },
      {
        key: 'class', label: 'Class', type: 'select',
        options: ['O (Open Cell)', 'C (Closed Cell)'],
      },
    ],
    pipeFormValues: ['Tubing'],
  },

  {
    id: 'ceramic-wool',
    name: 'Ceramic Wool',
    category: 'Insulation',
    makes: ['Alkagen', 'Mandelia Insulation', 'KK Packing', 'Unifrax'],
    forms: ['Blanket', 'Rope', 'Board', 'Paper'],
    defaultUom: 'SQM',
    specFields: [
      {
        key: 'grade', label: 'Grade', type: 'select',
        options: ['1260°C', '1425°C', '1600°C'],
      },
      DENSITY_CERAMIC,
      THICKNESS_INSULATION,
      { key: 'width', label: 'Width', type: 'select', unit: 'mm', options: ['610', '1220'] },
      { key: 'length', label: 'Length', type: 'select', unit: 'm', options: ['4.88', '7.32'] },
    ],
  },

  {
    id: 'puf',
    name: 'PUF',
    category: 'Insulation',
    makes: ['Excelsior Ceramic Industries', 'Supreme Industries', 'Sintex'],
    forms: ['Section (CNC Cut)', 'Slab'],
    defaultUom: 'NOS',
    specFields: PUF_AREA_FIELDS,
    pipeFields: PUF_PIPE_FIELDS,
    pipeFormValues: ['Section (CNC Cut)'],
  },

  {
    id: 'pir',
    name: 'PIR',
    category: 'Insulation',
    makes: ['Excelsior Ceramic Industries', 'Recticel', 'Kingspan'],
    forms: ['Section (CNC Cut)', 'Slab', 'Board'],
    defaultUom: 'NOS',
    specFields: PUF_AREA_FIELDS,
    pipeFields: PUF_PIPE_FIELDS,
    pipeFormValues: ['Section (CNC Cut)'],
  },

  {
    id: 'nitrile-foam',
    name: 'Nitrile Foam',
    category: 'Insulation',
    makes: ['Supreme Industries', 'Armacell', 'K-FLEX'],
    forms: ['Sheet', 'Tubing'],
    defaultUom: 'SQM',
    specFields: [
      { key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
        options: ['40', '50', '60', '80'] },
      { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['6', '9', '10', '13', '16', '19', '25', '32', '38', '50'] },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'm' },
      {
        key: 'facing', label: 'Facing / Finish', type: 'select',
        options: ['Plain', 'Self Adhesive', 'Aluminium Foil'],
      },
    ],
    pipeFields: [
      NB, OD,
      { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['6', '9', '10', '13', '16', '19', '25', '32', '38'] },
      LENGTH_PIPE,
      {
        key: 'type', label: 'Type', type: 'select',
        options: ['Plain', 'Self Adhesive'],
      },
    ],
    pipeFormValues: ['Tubing'],
  },

  {
    id: 'cellular-glass',
    name: 'Cellular Glass',
    category: 'Insulation',
    makes: ['Excelsior Ceramic Industries', 'Sun Refractories', 'Foamglas'],
    forms: ['Slab', 'Pipe Section'],
    defaultUom: 'SQM',
    specFields: [
      { key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
        options: ['120', '135', '145', '160'] },
      { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['40', '50', '60', '80', '100', '120', '140', '160'] },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
      {
        key: 'type', label: 'Type', type: 'select',
        options: ['Plain Block', 'Factory Coated'],
      },
    ],
    pipeFields: [
      { key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
        options: ['120', '135', '145', '160'] },
      NB, OD,
      { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['40', '50', '60', '80', '100'] },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
      {
        key: 'type', label: 'Type', type: 'select',
        options: ['Half Section', 'Full Section'],
      },
    ],
    pipeFormValues: ['Pipe Section'],
  },

  {
    id: 'perlite',
    name: 'Perlite',
    category: 'Insulation',
    makes: ['Mehul Filter Aid', 'Vinayak Gypsum & Interiors'],
    forms: ['Slab', 'Pipe Section'],
    defaultUom: 'SQM',
    specFields: [
      { key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
        options: ['200', '250', '300', '350'] },
      { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['40', '50', '65', '75', '100'] },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
      {
        key: 'type', label: 'Type', type: 'select',
        options: ['Plain Slab', 'Water Repellent'],
      },
    ],
    pipeFields: [
      { key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
        options: ['200', '250', '300', '350'] },
      NB, OD,
      { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['40', '50', '65', '75', '100'] },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
      {
        key: 'type', label: 'Type', type: 'select',
        options: ['Pipe Section', 'Moulded Section'],
      },
    ],
    pipeFormValues: ['Pipe Section'],
  },

  {
    id: 'calcium-silicate',
    name: 'Calcium Silicate',
    category: 'Insulation',
    makes: ['Ramco Industries Limited', 'Calderys India', 'Skamol'],
    forms: ['Board', 'Pipe Section'],
    defaultUom: 'SQM',
    specFields: [
      {
        key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['6', '8', '10', '12', '16', '20', '25', '40', '50'],
      },
      {
        key: 'width', label: 'Width', type: 'select', unit: 'ft',
        options: ['4'],
      },
      {
        key: 'length', label: 'Length', type: 'select', unit: 'ft',
        options: ['6', '8'],
      },
      {
        key: 'size', label: 'Size', type: 'select',
        options: ['6 x 4', '8 x 4'],
      },
    ],
    pipeFields: [
      NB, OD,
      { key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['25', '40', '50', '65', '75', '100'] },
      LENGTH_PIPE,
    ],
    pipeFormValues: ['Pipe Section'],
  },

  // ── Cladding / Jacketing ───────────────────────────────────────────────────

  {
    id: 'aluminium',
    name: 'Aluminium',
    category: 'Cladding',
    makes: ['Multiform', 'Interarch', 'Alubest', 'Hindalco'],
    forms: ['Sheets', 'Coils'],
    defaultUom: 'SQM',
    specFields: [
      {
        key: 'alloy', label: 'Alloy', type: 'select',
        options: ['1050', '1060', '1100', '3003', '3105'],
      },
      {
        key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '1.0', '1.2', '1.5', '2.0'],
      },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
      {
        key: 'finish', label: 'Finish', type: 'select',
        options: ['Mill Finish', 'Stucco Embossed', 'Polysurlyn Moisture Barrier'],
      },
    ],
  },

  {
    id: 'galvanised-steel',
    name: 'Galvanised Steel',
    category: 'Cladding',
    makes: ['Multiform', 'Tata Steel', 'JSW Steel'],
    forms: ['Sheets', 'Coils'],
    defaultUom: 'SQM',
    specFields: [
      {
        key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '1.0'],
      },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
      {
        key: 'gsm', label: 'GSM (Zinc Coating)', type: 'select', unit: 'g/m²',
        options: ['80', '120', '180', '275'],
      },
      {
        key: 'finish', label: 'Finish', type: 'select',
        options: ['Plain', 'Corrugated'],
      },
    ],
  },

  {
    id: 'stainless-steel',
    name: 'Stainless Steel',
    category: 'Cladding',
    makes: ['Multiform', 'Jindal Stainless', 'Suresh Steel Centre'],
    forms: ['Sheets', 'Coils'],
    defaultUom: 'SQM',
    specFields: [
      {
        key: 'grade', label: 'Grade', type: 'select',
        options: ['SS 304', 'SS 304L', 'SS 316', 'SS 316L'],
      },
      {
        key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['0.3', '0.4', '0.5', '0.6', '0.8', '1.0', '1.2', '1.5', '2.0'],
      },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
      {
        key: 'finish', label: 'Finish', type: 'select',
        options: ['2B', 'BA', 'Matt', 'Mirror'],
      },
    ],
  },

  {
    id: 'hdpe',
    name: 'HDPE',
    category: 'Cladding',
    makes: ['Sangir Plastics', 'Shreeram Polymers'],
    forms: ['Sheets'],
    defaultUom: 'SQM',
    specFields: [
      {
        key: 'density', label: 'Density', type: 'select', unit: 'kg/m³',
        options: ['940', '950', '960', '970'],
      },
      {
        key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['3', '4', '5', '6', '8', '10', '12', '15', '20', '25'],
      },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
      {
        key: 'color', label: 'Color', type: 'select',
        options: ['Black', 'White', 'Natural'],
      },
      {
        key: 'surface', label: 'Surface', type: 'select',
        options: ['Plain', 'Textured'],
      },
    ],
  },

  // ── Roofing ────────────────────────────────────────────────────────────────

  {
    id: 'roofing-shingles',
    name: 'Roofing Shingles',
    category: 'Roofing',
    makes: ['Owens Corning'],
    forms: ['Shingle'],
    defaultUom: 'SQM',
    specFields: [
      {
        key: 'series', label: 'Series', type: 'select',
        options: ['Classic Super', 'Duration', 'Oakridge', 'TruDefinition Duration'],
      },
      {
        key: 'windResistance', label: 'Wind Resistance', type: 'select', unit: 'kmph',
        options: ['130', '180'],
      },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
    ],
  },

  // ── Accessories ────────────────────────────────────────────────────────────

  {
    id: 'wires',
    name: 'Wires',
    category: 'Accessories',
    makes: ['Multiform', 'Suresh Steel Centre'],
    forms: ['Coil'],
    defaultUom: 'KG',
    specFields: [
      {
        key: 'wireMaterial', label: 'Wire Material', type: 'select',
        options: ['Stainless Steel Wire', 'Galvanized Wire'],
      },
      {
        key: 'grade', label: 'Grade / Coating', type: 'select',
        options: ['SS 304', 'SS 316', '15 GSM', '30 GSM', '60 GSM', '90 GSM'],
      },
      {
        key: 'diameter', label: 'Wire Diameter', type: 'select', unit: 'mm',
        options: ['0.5', '0.7', '0.8', '1.0', '1.2', '1.6', '2.0'],
      },
      {
        key: 'size', label: 'Mesh Size', type: 'select',
        options: ['8 x 4', '16 mm', 'Custom'],
      },
    ],
  },

  {
    id: 'screws',
    name: 'Screws / Fasteners',
    category: 'Accessories',
    makes: ['Pioneer Fasteners', 'Hilti', 'Fischer'],
    forms: ['Self Tapping Screws', 'Hex Bolts'],
    defaultUom: 'NOS',
    specFields: [
      {
        key: 'screwMaterial', label: 'Material', type: 'select',
        options: ['Ni-Cd Coated', 'SS 304', 'SS 316', 'Zinc Plated'],
      },
      {
        key: 'grade', label: 'Grade / Size', type: 'select',
        options: ['8 x 12', '8 x 16', '8 x 20', '8 x 25', '8 x 32', '10 x 25', '10 x 32'],
      },
      { key: 'diameter', label: 'Diameter', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'mm' },
      {
        key: 'packingUnit', label: 'Packing Unit', type: 'select',
        options: ['Box of 100', 'Box of 200', 'Box of 500', 'Box of 1000'],
      },
    ],
  },

  {
    id: 'wing-seal',
    name: 'Wing Seal',
    category: 'Accessories',
    makes: ['Kundar Technoplast Private Limited'],
    forms: ['Wing Seal'],
    defaultUom: 'BOX',
    specFields: [
      {
        key: 'sealMaterial', label: 'Material', type: 'select',
        options: ['Mild Steel', 'Stainless Steel', 'Aluminium'],
      },
      {
        key: 'sealThickness', label: 'Seal Thickness', type: 'select', unit: 'mm',
        options: ['0.5', '0.8'],
      },
      {
        key: 'size', label: 'Size', type: 'select', unit: 'mm',
        options: ['13', '16', '19'],
      },
    ],
  },

  {
    id: 'insulation-bands',
    name: 'Insulation Bands',
    category: 'Accessories',
    makes: ['Mutha Plastic Industries', 'Suresh Steel Centre'],
    forms: ['Coil'],
    defaultUom: 'KG',
    specFields: [
      {
        key: 'bandMaterial', label: 'Material', type: 'select',
        options: ['Aluminium', 'Stainless Steel', 'Galvanized Steel'],
      },
      {
        key: 'grade', label: 'Grade', type: 'select',
        options: ['H14', 'H16', 'SS 304', 'SS 316', '120 GSM'],
      },
      {
        key: 'thickness', label: 'Thickness', type: 'select', unit: 'mm',
        options: ['0.4', '0.5', '0.6', '0.8', '1.0'],
      },
      {
        key: 'width', label: 'Width', type: 'select', unit: 'mm',
        options: ['12', '16', '19', '25', '32'],
      },
    ],
  },

  // ── Films & Foils ──────────────────────────────────────────────────────────

  {
    id: 'vapor-barrier',
    name: 'Vapor Barrier',
    category: 'Films & Foils',
    makes: ['Supreme Industries Limited', 'Technonicol India'],
    forms: ['Roll'],
    defaultUom: 'SQM',
    specFields: [
      {
        key: 'material', label: 'Material', type: 'select',
        options: ['Mylar (Polyester Film + Al Foil)', 'Aluminium'],
      },
      {
        key: 'thickness', label: 'Thickness', type: 'select',
        options: ['50 ± 5% μm', '75 μm', '100 μm', '125 μm'],
      },
      {
        key: 'serviceTemp', label: 'Service Temp.', type: 'select',
        options: ['-40°C to +150°C', '-60°C to +150°C'],
      },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'm' },
    ],
  },

  {
    id: 'mylar-foil',
    name: 'Mylar Foil',
    category: 'Films & Foils',
    makes: ['Multiform'],
    forms: ['Roll'],
    defaultUom: 'SQM',
    specFields: [
      {
        key: 'construction', label: 'Construction', type: 'select',
        options: [
          '12/25/12 (Al/Poly/Al)',
          '12/50/12 (Al/Poly/Al)',
          '50 ± 5% μm (Polyester + Al Foil)',
        ],
      },
      { key: 'thickness', label: 'Thickness', type: 'number', unit: 'micron' },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'm' },
      {
        key: 'application', label: 'Application', type: 'select',
        options: ['Vapor Barrier', 'HVAC Duct Insulation', 'Pipe Insulation'],
      },
    ],
  },

  {
    id: 'glass-cloth',
    name: 'Glass Cloth',
    category: 'Films & Foils',
    makes: ['Montex Glass Fibre Industries', 'Rex Sealing & Packing Industries'],
    forms: ['Cloth (Open Weave)', 'Woven Cloth'],
    defaultUom: 'SQM',
    specFields: [
      { key: 'specification', label: 'Specification', type: 'text' },
      { key: 'thickness', label: 'Thickness', type: 'text', unit: 'mm' },
      { key: 'width', label: 'Width', type: 'number', unit: 'mm' },
      { key: 'length', label: 'Length', type: 'number', unit: 'm' },
      {
        key: 'gsm', label: 'GSM', type: 'select', unit: 'g/m²',
        options: ['100', '150', '200', '280', '350', '400'],
      },
    ],
  },

  {
    id: 'adhesives',
    name: 'Adhesives',
    category: 'Accessories',
    makes: ['TIC', 'Pidilite', 'Fevicol', '3M'],
    forms: ['Contact Adhesive', 'Tape'],
    defaultUom: 'Ltr',
    specFields: [
      {
        key: 'adhesiveType', label: 'Adhesive Type', type: 'select',
        options: ['Synthetic Rubber Based', 'Neoprene Based', 'Solvent Based Contact Adhesive'],
      },
      {
        key: 'application', label: 'Application', type: 'select',
        options: [
          'Nitrile Rubber', 'XLPE', 'Fiberglass', 'Rockwool',
          'HVAC Duct Insulation', 'Pipe Insulation', 'General',
        ],
      },
      {
        key: 'packing', label: 'Packing', type: 'select',
        options: ['1 Ltr', '5 Ltr', '20 Ltr', '200 Ltr'],
      },
    ],
  },

];

// ─── Helper functions ─────────────────────────────────────────────────────────

/** Get a material definition by its id */
export function getMaterialById(id: string): MaterialDef | undefined {
  return MATERIAL_MASTER.find(m => m.id === id);
}

/** Get material names grouped by category for displaying in a grouped dropdown */
export function getMaterialsByCategory(): Record<MaterialCategory, MaterialDef[]> {
  const result: Record<string, MaterialDef[]> = {};
  for (const m of MATERIAL_MASTER) {
    if (!result[m.category]) result[m.category] = [];
    result[m.category].push(m);
  }
  return result as Record<MaterialCategory, MaterialDef[]>;
}

/**
 * Resolve the correct spec fields for a material + form combination.
 * Returns pipeFields when the selected form is in pipeFormValues,
 * otherwise returns specFields.
 */
export function getSpecFields(materialId: string, form: string): FieldDef[] {
  const mat = getMaterialById(materialId);
  if (!mat) return [];
  if (mat.pipeFields && mat.pipeFormValues?.includes(form)) {
    return mat.pipeFields;
  }
  return mat.specFields;
}

/** All unique material category names */
export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'Insulation', 'Cladding', 'Roofing', 'Accessories', 'Films & Foils',
];

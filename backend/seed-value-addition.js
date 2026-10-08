import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool, initDatabase } from "./database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });
dotenv.config();

const dataset = [
  // 1. RICE
  {
    crop_name: "Rice",
    products: [
      {
        product_name: "Rice Flour",
        category: "Flour & Milling",
        description: "Fine flour milled from polished or brown rice grains, suitable for bakery, snacks, and traditional batter formulations.",
        multiplier: 1.60,
        guide: {
          title: "Commercial Rice Flour Milling & Processing",
          processing_method: "Dry Milling",
          difficulty_level: "Beginner",
          yield_pct: 85.00,
          time_hours: 4.0,
          summary: "Cleaning, conditioning, pulverizing, and sieving paddy/milled rice into food-grade rice flour.",
          source_reference: "ICAR-Central Institute of Agricultural Engineering (CIAE) Milling Manual & FSSAI Cereal Standards",
          stages: [
            { stage_number: 1, stage_name: "Grain Cleaning & Destoning", description: "Pass raw paddy/rice through air-screen cleaner and destoner to remove chaff, dust, and stones.", duration_minutes: 30, temp_c: null, cc_points: "Ensure moisture content is below 14% to prevent clogging." },
            { stage_number: 2, stage_name: "Conditioning & Tempering", description: "Adjust grain moisture uniformly for optimum milling efficiency.", duration_minutes: 60, temp_c: null, cc_points: "Maintain ambient temperature and uniform moisture distribution." },
            { stage_number: 3, stage_name: "Pulverizing & Grinding", description: "Grind conditioned rice using a stainless steel hammer mill or pin mill.", duration_minutes: 45, temp_c: 40.0, cc_points: "Control mill temperature below 45°C to avoid starch gelatinization." },
            { stage_number: 4, stage_name: "Sieving & Fine Grading", description: "Pass milled powder through a vibratory sifter (80-100 mesh size).", duration_minutes: 30, temp_c: null, cc_points: "Inspect mesh regularly to ensure particle size uniformity." }
          ],
          equipment: [
            { equipment_name: "Air Screen Grain Cleaner", equipment_type: "Cleaner", specification: "Capacity 500 kg/hr, 2 HP motor", is_mandatory: 1, cost_min: 45000, cost_max: 85000 },
            { equipment_name: "Stainless Steel Hammer Mill", equipment_type: "Grinder", specification: "100 kg/hr throughput, 80-mesh sieve screen", is_mandatory: 1, cost_min: 65000, cost_max: 120000 },
            { equipment_name: "Vibratory Sifter", equipment_type: "Sieve", specification: "Multi-deck 100 mesh, food grade SS 304", is_mandatory: 1, cost_min: 30000, cost_max: 55000 }
          ],
          packaging: { packaging_type: "Pillow Pouch / HDPE Bags", material_specification: "100 micron food-grade LDPE/Laminated Film", temp_min: 15.0, temp_max: 30.0, humidity_max: 65.0, shelf_life: 180, storage_instructions: "Store in a cool, dry, pest-free warehouse on wooden pallets." },
          market_info: { target_market: "Bakeries, Noodle Manufacturers, Domestic Retail, Food Service", commercial_uses: "Breading, gluten-free baking, rice noodles, snack extruded foods", demand_level: "High", quality_standards: "FSSAI Moisture < 13%, Ash < 1.0%, Free from live insect infestation.", govt_schemes_info: "PM Formalisation of Micro food processing Enterprises (PMFME) Scheme provides 35% credit-linked capital subsidy." }
        }
      },
      {
        product_name: "Puffed Rice (Murmura)",
        category: "Processed Foods",
        description: "Lightweight expanded rice grains produced by high-temperature short-time thermal puffing.",
        multiplier: 2.20,
        guide: {
          title: "Parboiling & Thermal Puffing of Paddy/Rice",
          processing_method: "Thermal Puffing",
          difficulty_level: "Intermediate",
          yield_pct: 70.00,
          time_hours: 6.0,
          summary: "Salt conditioning, pre-heating, and rapid thermal puffing using hot sand or continuous fluid bed expanders.",
          source_reference: "CFTRI Post-Harvest Technology Bulletin on Grain Expansion",
          stages: [
            { stage_number: 1, stage_name: "Salt Solution Conditioning", description: "Soak parboiled rice in 2-3% brine solution for moisture and sodium conditioning.", duration_minutes: 90, temp_c: 60.0, cc_points: "Maintain exact salt concentration for optimal expansion." },
            { stage_number: 2, stage_name: "Pre-drying & Tempering", description: "Dry conditioned rice to 10-12% moisture level.", duration_minutes: 120, temp_c: 50.0, cc_points: "Prevent over-drying which causes grain charring." },
            { stage_number: 3, stage_name: "Thermal Expansion / Puffing", description: "Pass grain through high-temperature roasting cylinder (200-240°C) with salt/sand medium.", duration_minutes: 5, temp_c: 230.0, cc_points: "Rapid short-time exposure to prevent burning." },
            { stage_number: 4, stage_name: "Sifting & Cooling", description: "Separate expanded murmura from heating medium and air cool.", duration_minutes: 15, temp_c: 25.0, cc_points: "Pack immediately to avoid moisture absorption and sogginess." }
          ],
          equipment: [
            { equipment_name: "Continuous Roasting & Puffing Machine", equipment_type: "Puffer", specification: "Gas/LPG fired continuous roaster, 150 kg/hr", is_mandatory: 1, cost_min: 120000, cost_max: 250000 },
            { equipment_name: "Rotary Sand/Grain Separator", equipment_type: "Separator", specification: "Rotary mesh drum SS 304", is_mandatory: 1, cost_min: 35000, cost_max: 70000 }
          ],
          packaging: { packaging_type: "Nitrogen Flushed Metallic Pouches", material_specification: "Metalized BOPP/PE 70 micron high moisture barrier", temp_min: 15.0, temp_max: 32.0, humidity_max: 55.0, shelf_life: 120, storage_instructions: "Keep hermetically sealed; store away from moisture and direct sunlight." },
          market_info: { target_market: "Snack Manufacturers, Street Food Vendors, Retail Chains", commercial_uses: "Bhel puri, snack mixes, breakfast cereals", demand_level: "High", quality_standards: "FSSAI Moisture < 8%, Expansion ratio > 6:1", govt_schemes_info: "KVIC MSME Subsidy for rural agro-processing units." }
        }
      },
      {
        product_name: "Rice Bran Oil",
        category: "Edible Oils",
        description: "Heart-healthy edible oil extracted from the outer brown layer (bran) of rice grains.",
        multiplier: 2.80,
        guide: {
          title: "Solvent Extraction & Refining of Rice Bran Oil",
          processing_method: "Solvent Extraction",
          difficulty_level: "Advanced",
          yield_pct: 16.00,
          time_hours: 12.0,
          summary: "Stabilization of fresh bran, solvent extraction using food-grade hexane, and physical refining.",
          source_reference: "Indian Rice Millers Association & IIOF (Indian Institute of Oilseeds Research)",
          stages: [
            { stage_number: 1, stage_name: "Bran Stabilization", description: "Pass fresh rice bran through steam expander to deactivate lipase enzymes.", duration_minutes: 30, temp_c: 105.0, cc_points: "Process within 6 hours of rice milling to prevent FFA spike." },
            { stage_number: 2, stage_name: "Pelletization", description: "Form stabilized bran into porous pellets for efficient solvent percolation.", duration_minutes: 45, temp_c: null, cc_points: "Ensure optimal bulk density and moisture 9-10%." },
            { stage_number: 3, stage_name: "Solvent Extraction", description: "Extract crude oil using food-grade hexane in continuous extractor.", duration_minutes: 180, temp_c: 65.0, cc_points: "Strict solvent recovery monitoring and explosion-proof fittings." },
            { stage_number: 4, stage_name: "De-gumming & Refining", description: "Enzymatic degumming, dewaxing, and bleaching to obtain refined oil.", duration_minutes: 240, temp_c: 90.0, cc_points: "Preserve natural Oryzanol content > 1.0%." }
          ],
          equipment: [
            { equipment_name: "Steam Bran Stabilizer", equipment_type: "Stabilizer", specification: "Continuous jacketed steam extruder, 500 kg/hr", is_mandatory: 1, cost_min: 180000, cost_max: 350000 },
            { equipment_name: "Solvent Extraction Plant", equipment_type: "Extractor", specification: "Industrial Grade Multi-Stage Extractor", is_mandatory: 1, cost_min: 1500000, cost_max: 4500000 }
          ],
          packaging: { packaging_type: "Food Grade PET Bottles / Tin Cans", material_specification: "1 Litre / 5 Litre UV-blocking PET bottles", temp_min: 10.0, temp_max: 30.0, humidity_max: 70.0, shelf_life: 365, storage_instructions: "Store in cool dark warehouse away from oxidizers." },
          market_info: { target_market: "Edible Oil Refineries, FMCG Brands, Supermarkets", commercial_uses: "High smoke-point cooking oil, nutraceutical Oryzanol extracts", demand_level: "High", quality_standards: "FSSAI Refined Rice Bran Oil: FFA < 0.25%, Oryzanol > 10000 ppm", govt_schemes_info: "National Mission on Edible Oils - Oil Palm/Oilseeds (NMEO) assistance." }
        }
      }
    ]
  },

  // 2. MAIZE
  {
    crop_name: "Maize",
    products: [
      {
        product_name: "Maize Flour (Cornmeal)",
        category: "Flour & Milling",
        description: "Coarse or fine meal ground from whole yellow or white maize kernels.",
        multiplier: 1.70,
        guide: {
          title: "Dry Degerming & Milling of Maize Kernels",
          processing_method: "Dry Milling",
          difficulty_level: "Beginner",
          yield_pct: 78.00,
          time_hours: 5.0,
          summary: "Cleaning, degerming to separate germ and hull, and roller milling into cornmeal/flour.",
          source_reference: "ICAR-Indian Institute of Maize Research (IIMR) Processing Guide",
          stages: [
            { stage_number: 1, stage_name: "Screening & Cleaning", description: "Remove broken kernels, cob fragments, and dust via aspirator.", duration_minutes: 30, temp_c: null, cc_points: "Inspect for aflatoxin contamination under UV light if needed." },
            { stage_number: 2, stage_name: "Degerming & Dehulling", description: "Pass through maize degermer to remove germ and pericarp.", duration_minutes: 60, temp_c: null, cc_points: "Adjust impact rotor speed to maximize germ recovery." },
            { stage_number: 3, stage_name: "Roller Reduction Milling", description: "Mill endosperm fractions into uniform flour and grits.", duration_minutes: 90, temp_c: 38.0, cc_points: "Prevent fat transfer from remaining germ to extend shelf life." }
          ],
          equipment: [
            { equipment_name: "Maize Degermer Machine", equipment_type: "Degermer", specification: "Impact degermer with screen, 300 kg/hr", is_mandatory: 1, cost_min: 95000, cost_max: 180000 },
            { equipment_name: "Double Roller Mill", equipment_type: "Mill", specification: "Chilled iron rolls, 250 kg/hr", is_mandatory: 1, cost_min: 140000, cost_max: 280000 }
          ],
          packaging: { packaging_type: "Polypropylene (PP) Woven Sacks with Inner Liner", material_specification: "50 kg / 5 kg food-grade PP laminated bags", temp_min: 15.0, temp_max: 30.0, humidity_max: 60.0, shelf_life: 150, storage_instructions: "Store on dunnage in well-ventilated dry storage." },
          market_info: { target_market: "Food Manufacturers, Snack Units, Retail Consumer Market", commercial_uses: "Tortilla chips, polenta, cornbread, porridge, extrusion feeds", demand_level: "High", quality_standards: "FSSAI Fat < 3.0%, Moisture < 12.5%, Aflatoxin < 15 ppb", govt_schemes_info: "PMFME credit subsidy for maize value addition clusters." }
        }
      },
      {
        product_name: "Maize Starch",
        category: "Processed Foods",
        description: "High-purity starch isolated from maize endosperm for culinary, pharmaceutical, and industrial use.",
        multiplier: 3.10,
        guide: {
          title: "Wet Milling & Starch Isolation from Maize",
          processing_method: "Wet Milling",
          difficulty_level: "Advanced",
          yield_pct: 62.00,
          time_hours: 36.0,
          summary: "Sulfur dioxide steeping, coarse grinding, hydroclone germ separation, fine grinding, and centrifugal starch extraction.",
          source_reference: "CSIR-CFTRI Starch Processing Manual",
          stages: [
            { stage_number: 1, stage_name: "Sulfur Dioxide Steeping", description: "Steep maize kernels in warm water with 0.1-0.2% SO2 to soften protein matrix.", duration_minutes: 1800, temp_c: 50.0, cc_points: "Maintain pH 3.8-4.2 and SO2 concentration." },
            { stage_number: 2, stage_name: "Germ & Fiber Separation", description: "Coarse grind steeped corn and separate floating germ via liquid hydroclones.", duration_minutes: 120, temp_c: null, cc_points: "Prevent germ rupture to keep oil separate from starch slurry." },
            { stage_number: 3, stage_name: "Starch-Gluten Centrifugal Separation", description: "Pass starch slurry through high-speed disk centrifuges.", duration_minutes: 60, temp_c: null, cc_points: "Ensure protein content in starch cake is below 0.4%." },
            { stage_number: 4, stage_name: "Flash Drying", description: "Dry starch cake in pneumatic flash dryer to 12% moisture.", duration_minutes: 30, temp_c: 120.0, cc_points: "Control exit air temperature to prevent thermal scorching." }
          ],
          equipment: [
            { equipment_name: "Stainless Steel Steeping Tanks", equipment_type: "Steeper", specification: "5000 Litre SS 316 jacketed steep tank", is_mandatory: 1, cost_min: 250000, cost_max: 550000 },
            { equipment_name: "Starch Hydroclone System", equipment_type: "Separator", specification: "Multi-stage nylon hydroclone manifold", is_mandatory: 1, cost_min: 320000, cost_max: 750000 },
            { equipment_name: "Pneumatic Flash Dryer", equipment_type: "Dryer", specification: "Capacity 500 kg/hr wet cake input", is_mandatory: 1, cost_min: 450000, cost_max: 950000 }
          ],
          packaging: { packaging_type: "Multi-wall Paper Bags with PE Liner", material_specification: "25 kg paper-poly composite moisture proof bags", temp_min: 10.0, temp_max: 30.0, humidity_max: 55.0, shelf_life: 730, storage_instructions: "Store in humidity-controlled dry warehouse." },
          market_info: { target_market: "Pharma Excipient Manufacturers, Textile Sizing, Confectionery", commercial_uses: "Thickening agent, binder, sweetener feedstock (glucose/fructose)", demand_level: "High", quality_standards: "FSSAI Starch purity > 98%, Protein < 0.45%, SO2 < 50 ppm", govt_schemes_info: "MSME Technology Upgradation Scheme for starch processing." }
        }
      }
    ]
  },

  // 3. GROUNDNUT
  {
    crop_name: "Groundnut",
    products: [
      {
        product_name: "Cold-Pressed Groundnut Oil",
        category: "Edible Oils",
        description: "Unrefined aromatic peanut oil extracted using traditional wood/steel rotary expellers at low temperatures.",
        multiplier: 2.50,
        guide: {
          title: "Mechanical Cold Press Extraction of Groundnut Oil",
          processing_method: "Cold Pressing (Ghani)",
          difficulty_level: "Beginner",
          yield_pct: 42.00,
          time_hours: 3.0,
          summary: "Decortication, kernel cleaning, low-temperature mechanical extraction, and natural cloth filtration.",
          source_reference: "ICAR-Directorate of Groundnut Research (DGR) Processing Guidelines",
          stages: [
            { stage_number: 1, stage_name: "Decortication & Kernel Selection", description: "Shell groundnut pods and separate sound kernels from shriveled/moldy nuts.", duration_minutes: 45, temp_c: null, cc_points: "Reject moldy nuts to prevent Aflatoxin contamination." },
            { stage_number: 2, stage_name: "Cold Press Extraction", description: "Crush kernels in wooden/steel rotary oil ghani without external heating.", duration_minutes: 60, temp_c: 42.0, cc_points: "Keep extraction temperature strictly under 50°C." },
            { stage_number: 3, stage_name: "Sedimentation & Cotton Cloth Filtration", description: "Allow crude oil to settle for 24 hours then filter through unbleached cotton cloth.", duration_minutes: 60, temp_c: null, cc_points: "Avoid chemical refining agents or high heat bleaching." }
          ],
          equipment: [
            { equipment_name: "Groundnut Decorticator", equipment_type: "Sheller", specification: "200 kg/hr pod sheller with blower", is_mandatory: 1, cost_min: 35000, cost_max: 65000 },
            { equipment_name: "Wooden Cold Press Ghani", equipment_type: "Oil Press", specification: "Vagai wood rotary press, 15 kg batch capacity, 3 HP", is_mandatory: 1, cost_min: 110000, cost_max: 190000 },
            { equipment_name: "Filter Press Unit", equipment_type: "Filter", specification: "12-plate SS filter press pump", is_mandatory: 1, cost_min: 45000, cost_max: 85000 }
          ],
          packaging: { packaging_type: "Tin Cans / Glass Bottles / Food-Grade PET", material_specification: "1L / 5L food-grade containers with tamper evident caps", temp_min: 15.0, temp_max: 28.0, humidity_max: 65.0, shelf_life: 270, storage_instructions: "Store away from heat and direct sunlight to prevent rancidity." },
          market_info: { target_market: "Health-conscious Retail Consumers, Organic Markets, Gourmet Kitchens", commercial_uses: "Traditional deep frying, sautéing, salad dressings", demand_level: "High", quality_standards: "FSSAI Unrefined Groundnut Oil: Acid Value < 4.0, Aflatoxin < 10 ppb", govt_schemes_info: "PMFME 35% subsidy for micro oil extraction enterprises." }
        }
      },
      {
        product_name: "Peanut Butter",
        category: "Processed Foods",
        description: "Smooth or crunchy spread produced by roasting and micro-grinding shelled groundnuts.",
        multiplier: 3.20,
        guide: {
          title: "Roasting & Micro-Grinding of Groundnuts for Peanut Butter",
          processing_method: "Grinding & Homogenization",
          difficulty_level: "Intermediate",
          yield_pct: 90.00,
          time_hours: 4.0,
          summary: "Dry roasting kernels, blanching/skin removal, colloidal grinding with salt/stabilizer, and degassing.",
          source_reference: "CFTRI Food Processing Technology Series on Nut Butters",
          stages: [
            { stage_number: 1, stage_name: "Dry Roasting", description: "Roast shelled kernels uniformly in batch roaster.", duration_minutes: 30, temp_c: 160.0, cc_points: "Achieve uniform golden-brown color without charring." },
            { stage_number: 2, stage_name: "Blanching & De-skinning", description: "Pass warm kernels through rubber roller blancher to remove red skins.", duration_minutes: 20, temp_c: null, cc_points: "Remove > 95% of skins and heart germs to avoid bitterness." },
            { stage_number: 3, stage_name: "Colloid Milling & Homogenization", description: "Grind roasted nuts in colloid mill to particle size < 150 microns.", duration_minutes: 40, temp_c: 65.0, cc_points: "Add 1-2% hydrogenated vegetable oil/salt to prevent oil separation." },
            { stage_number: 4, stage_name: "Vacuum Degassing & Cooling", description: "Remove entrapped air bubbles and cool to room temperature.", duration_minutes: 30, temp_c: 30.0, cc_points: "Prevent oxidation by thorough air evacuation before filling." }
          ],
          equipment: [
            { equipment_name: "Batch Gas Roaster", equipment_type: "Roaster", specification: "LPG fired drum roaster, 50 kg/batch", is_mandatory: 1, cost_min: 75000, cost_max: 140000 },
            { equipment_name: "Peanut Blancher & Skin Separator", equipment_type: "Blancher", specification: "Rubber roller rub blancher with cyclone dust collector", is_mandatory: 1, cost_min: 60000, cost_max: 110000 },
            { equipment_name: "Stainless Steel Colloid Mill", equipment_type: "Mill", specification: "SS 304 contact parts, 5 HP motor, 100 kg/hr", is_mandatory: 1, cost_min: 130000, cost_max: 240000 }
          ],
          packaging: { packaging_type: "Wide-Mouth PET / Glass Jars", material_specification: "350g / 1kg food-grade PET jar with foil induction seal", temp_min: 15.0, temp_max: 28.0, humidity_max: 60.0, shelf_life: 365, storage_instructions: "Store in a cool dry cabinet. Re-seal lid tightly after opening." },
          market_info: { target_market: "Fitness Consumers, Supermarkets, Institutional Caterers, Exports", commercial_uses: "Bread spread, protein shakes, confectionery filling", demand_level: "High", quality_standards: "FSSAI Moisture < 2%, Protein > 24%, Aflatoxin < 10 ppb", govt_schemes_info: "APEDA Export Incentive & PMFME Capital Subsidy." }
        }
      }
    ]
  },

  // 4. COCONUT
  {
    crop_name: "Coconut",
    products: [
      {
        product_name: "Virgin Coconut Oil (VCO)",
        category: "Edible Oils",
        description: "Pure oil extracted from fresh wet coconut meat without chemical refining, bleaching, or deodorizing.",
        multiplier: 4.50,
        guide: {
          title: "Wet Processing & Centrifugal Extraction of Virgin Coconut Oil",
          processing_method: "Centrifugal Extraction",
          difficulty_level: "Intermediate",
          yield_pct: 18.00,
          time_hours: 6.0,
          summary: "Deshelling, kernel grating, coconut milk extraction, centrifuge separation, and vacuum drying.",
          source_reference: "Coconut Development Board (CDB) India Technical Manual",
          stages: [
            { stage_number: 1, stage_name: "Deshelling & Paring", description: "Remove hard shell and pare brown testa layer from fresh mature coconut kernel.", duration_minutes: 45, temp_c: null, cc_points: "Use nuts 10-12 months mature; reject spoiled nuts." },
            { stage_number: 2, stage_name: "Disintegration & Milk Extraction", description: "Grate kernel and extract coconut milk using screw press.", duration_minutes: 60, temp_c: null, cc_points: "Use warm potable water (50°C) for maximum milk yield." },
            { stage_number: 3, stage_name: "Centrifugal Oil Separation", description: "Pass coconut milk cream through high-speed disc centrifuge (10000 RPM).", duration_minutes: 45, temp_c: 35.0, cc_points: "Continuous separation of pure oil phase from aqueous phase." },
            { stage_number: 4, stage_name: "Vacuum Moisture Removal", description: "Pass oil through vacuum dehydrator to reduce moisture < 0.1%.", duration_minutes: 30, temp_c: 45.0, cc_points: "Ensure moisture < 0.1% to prevent hydrolytic rancidity." }
          ],
          equipment: [
            { equipment_name: "Coconut Disintegrator / Grater", equipment_type: "Grater", specification: "SS 304 hammer disintegrator, 300 kg/hr", is_mandatory: 1, cost_min: 55000, cost_max: 95000 },
            { equipment_name: "Screw Milk Extractor Press", equipment_type: "Press", specification: "Continuous twin-screw press, 200 kg/hr", is_mandatory: 1, cost_min: 120000, cost_max: 220000 },
            { equipment_name: "High-Speed Tubular Centrifuge", equipment_type: "Centrifuge", specification: "15000 G-force liquid-liquid separator", is_mandatory: 1, cost_min: 350000, cost_max: 750000 }
          ],
          packaging: { packaging_type: "Clear Glass Bottles / Premium PET Bottles", material_specification: "250ml / 500ml glass bottle with tamper-evident aluminum cap", temp_min: 18.0, temp_max: 30.0, humidity_max: 65.0, shelf_life: 540, storage_instructions: "Store in ambient conditions; oil solidifies below 24°C naturally." },
          market_info: { target_market: "Nutraceutical Stores, Cosmetics Manufacturers, Export Buyers", commercial_uses: "Dietary supplement (Lauric acid source), skin moisturizer, hair care", demand_level: "High", quality_standards: "CDB / FSSAI VCO Standard: Free Fatty Acids < 0.2%, Moisture < 0.1%", govt_schemes_info: "Coconut Development Board (CDB) 25-50% Technology Subsidy." }
        }
      },
      {
        product_name: "Desiccated Coconut Powder",
        category: "Processed Foods",
        description: "Dehydrated, shredded white coconut kernel used extensively in confectionery and baking.",
        multiplier: 2.80,
        guide: {
          title: "Dehydration & Granulation of Fresh Coconut Meat",
          processing_method: "Dehydration & Shredding",
          difficulty_level: "Intermediate",
          yield_pct: 35.00,
          time_hours: 5.0,
          summary: "Blanching pared kernel, disintegration into fine shreds, continuous fluid bed drying, and grading.",
          source_reference: "CDB & CFTRI Post-Harvest Coconut Series",
          stages: [
            { stage_number: 1, stage_name: "Blanching / Steam Sterilization", description: "Subject pared kernel pieces to live steam.", duration_minutes: 20, temp_c: 100.0, cc_points: "Reduce bacterial load and deactivate oxidative enzymes." },
            { stage_number: 2, stage_name: "Disintegration / Shredding", description: "Shred kernel into fine/medium granules using pin cutter.", duration_minutes: 30, temp_c: null, cc_points: "Maintain sharp blades for clean particle cut." },
            { stage_number: 3, stage_name: "Fluidized Bed Drying", description: "Dry shredded coconut in hot air fluidized bed dryer.", duration_minutes: 60, temp_c: 80.0, cc_points: "Reduce moisture content strictly below 2.5%." }
          ],
          equipment: [
            { equipment_name: "Steam Blanching Cabinet", equipment_type: "Blancher", specification: "SS 304 steam blancher, 100 kg/batch", is_mandatory: 1, cost_min: 65000, cost_max: 120000 },
            { equipment_name: "Fluid Bed Dryer", equipment_type: "Dryer", specification: "Continuous hot air FBD, 150 kg/hr dry output", is_mandatory: 1, cost_min: 280000, cost_max: 550000 }
          ],
          packaging: { packaging_type: "Aluminum Foil Laminated Pouches in HDPE Bags", material_specification: "100 micron tri-layer foil laminate for oxygen & moisture barrier", temp_min: 15.0, temp_max: 30.0, humidity_max: 55.0, shelf_life: 270, storage_instructions: "Keep sealed in airtight containers; protect from humidity." },
          market_info: { target_market: "Bakeries, Confectionery Manufacturers, Curry Powder Formulators", commercial_uses: "Biscuits, chocolates, savory gravy bases, dessert toppings", demand_level: "High", quality_standards: "FSSAI Moisture < 3.0%, Oil Content > 60%, Salmonella Absent", govt_schemes_info: "CDB Agro-Processing Infrastructure Grant." }
        }
      }
    ]
  },

  // 5. TOMATO
  {
    crop_name: "Tomato",
    products: [
      {
        product_name: "Tomato Puree & Paste",
        category: "Processed Foods",
        description: "Concentrated tomato pulp prepared by hot-break extraction and vacuum evaporation.",
        multiplier: 3.50,
        guide: {
          title: "Hot-Break Extraction & Vacuum Evaporation of Tomatoes",
          processing_method: "Vacuum Evaporation",
          difficulty_level: "Intermediate",
          yield_pct: 20.00,
          time_hours: 5.0,
          summary: "Washing, sorting, hot-break pulping, double-effect vacuum concentration, and hot fill packaging.",
          source_reference: "ICAR-Indian Institute of Horticultural Research (IIHR) Tomato Processing Protocol",
          stages: [
            { stage_number: 1, stage_name: "Washing & Sorting", description: "Soak and spray-wash ripe red tomatoes; reject green or rot-affected fruits.", duration_minutes: 30, temp_c: null, cc_points: "Use chlorinated water (50 ppm) for sanitized washing." },
            { stage_number: 2, stage_name: "Hot-Break Chopping & Pulping", description: "Chop tomatoes and heat rapidly to 85-90°C before pulping through dual sieve pulper.", duration_minutes: 45, temp_c: 88.0, cc_points: "Hot-break deactivates pectinase enzymes to preserve high viscosity." },
            { stage_number: 3, stage_name: "Vacuum Concentration", description: "Evaporate pulp under vacuum (60 kPa) to achieve 24-28° Brix paste.", duration_minutes: 120, temp_c: 65.0, cc_points: "Low evaporation temperature preserves red lycopene color and flavor." },
            { stage_number: 4, stage_name: "Thermal Pasteurization & Hot Filling", description: "Heat paste to 92°C and hot-fill into cans/pouches followed by glass inversion.", duration_minutes: 30, temp_c: 92.0, cc_points: "Maintain hot fill temperature above 85°C for sterility." }
          ],
          equipment: [
            { equipment_name: "Fruit Washer & Sorting Conveyor", equipment_type: "Washer", specification: "Bubble washer with roller conveyor, 500 kg/hr", is_mandatory: 1, cost_min: 95000, cost_max: 160000 },
            { equipment_name: "Hot Break Pulper Unit", equipment_type: "Pulper", specification: "Dual stage SS pulper with pre-heater, 300 kg/hr", is_mandatory: 1, cost_min: 140000, cost_max: 260000 },
            { equipment_name: "Vacuum Pan / Evaporator", equipment_type: "Evaporator", specification: "Single effect vacuum concentrator, 200L capacity", is_mandatory: 1, cost_min: 280000, cost_max: 600000 }
          ],
          packaging: { packaging_type: "Aseptic Pouches / Cans / Glass Jars", material_specification: "Aseptic aluminum barrier bags (2kg/10kg) or lacquered food cans", temp_min: 10.0, temp_max: 30.0, humidity_max: 70.0, shelf_life: 365, storage_instructions: "Store unopened in ambient dry condition; refrigerate after opening." },
          market_info: { target_market: "HORECA Sector, Sauce Manufacturers, Retail Consumer Brands", commercial_uses: "Base for soups, ketchup, ready-to-eat curries, pizza sauces", demand_level: "High", quality_standards: "FSSAI Brix 24-28%, Acidity 1.5-2.0%, Mold count < 40% fields", govt_schemes_info: "PMFME & MoFPI Food Processing Subsidy Scheme." }
        }
      },
      {
        product_name: "Dehydrated Tomato Flakes",
        category: "Dehydrated Produce",
        description: "Crisp dehydrated tomato slices or flakes with concentrated flavor and long shelf life.",
        multiplier: 3.80,
        guide: {
          title: "Slicing & Hot Air Cabinet Drying of Tomatoes",
          processing_method: "Cabinet Drying",
          difficulty_level: "Beginner",
          yield_pct: 7.00,
          time_hours: 10.0,
          summary: "Firm tomato slicing, osmotic pretreatment with salt/metabisulfite, tray drying, and flake milling.",
          source_reference: "IIHR Post-Harvest Dehydration Protocol",
          stages: [
            { stage_number: 1, stage_name: "Slicing & Pre-treatment", description: "Slice firm ripe tomatoes to 5mm thickness and dip in 1% KMS/salt solution.", duration_minutes: 30, temp_c: null, cc_points: "Uniform slice thickness ensures even drying." },
            { stage_number: 2, stage_name: "Tray Loading & Cabinet Drying", description: "Arrange slices on stainless steel mesh trays and dry at 60°C.", duration_minutes: 480, temp_c: 60.0, cc_points: "Control relative humidity in dryer; target final moisture < 5%." },
            { stage_number: 3, stage_name: "Flaking & Hermetic Sealing", description: "Flake dried slices and pack immediately in moisture barrier film.", duration_minutes: 30, temp_c: 25.0, cc_points: "Prevent ambient moisture re-absorption." }
          ],
          equipment: [
            { equipment_name: "Commercial Fruit Slicer", equipment_type: "Slicer", specification: "Adjustable SS blade slicer, 150 kg/hr", is_mandatory: 1, cost_min: 35000, cost_max: 65000 },
            { equipment_name: "48-Tray Hot Air Cabinet Dryer", equipment_type: "Dryer", specification: "Digital temp controller, recirculating blower, SS trays", is_mandatory: 1, cost_min: 160000, cost_max: 290000 }
          ],
          packaging: { packaging_type: "Laminated Aluminum Foil Pouches", material_specification: "120 micron PET/Foil/PE moisture and light barrier", temp_min: 15.0, temp_max: 30.0, humidity_max: 50.0, shelf_life: 270, storage_instructions: "Store in cool dry environment away from light." },
          market_info: { target_market: "Instant Noodle/Soup Formulators, Seasoning Blenders, Export", commercial_uses: "Pre-cooked seasoning sachets, dry soup mixes, bakery toppings", demand_level: "Moderate", quality_standards: "FSSAI Moisture < 6.0%, Rehydration ratio > 1:4", govt_schemes_info: "NABARD Rural Innovation Infrastructure Grant." }
        }
      }
    ]
  },

  // 6. MANGO
  {
    crop_name: "Mango",
    products: [
      {
        product_name: "Mango Pulp & Puree",
        category: "Beverages",
        description: "Homogenous extracted fruit pulp from mature ripe mangoes (Alphonso, Totapuri, Kesar).",
        multiplier: 2.90,
        guide: {
          title: "Thermal Extraction & Canning of Mango Pulp",
          processing_method: "Hot Extraction & Pasteurization",
          difficulty_level: "Intermediate",
          yield_pct: 55.00,
          time_hours: 4.0,
          summary: "Fruit washing, destoning, pulping through multi-stage sieves, thermal pasteurization, and hot filling.",
          source_reference: "ICAR-Central Institute for Subtropical Horticulture (CISH) Processing Guide",
          stages: [
            { stage_number: 1, stage_name: "Ripening & Washing", description: "Ripen mature mangoes to optimal Brix (16-18°) and wash in chlorinated water.", duration_minutes: 45, temp_c: null, cc_points: "Reject unripened or fermented fruits." },
            { stage_number: 2, stage_name: "De-stoning & Pulp Extraction", description: "Pass peeled fruit through mango destoner and double pulper (1mm & 0.5mm sieves).", duration_minutes: 60, temp_c: null, cc_points: "Separate fiber and seed coat cleanly." },
            { stage_number: 3, stage_name: "Thermal Processing & De-aeration", description: "Heat pulp in tubular pasteurizer and pass through vacuum de-aerator.", duration_minutes: 30, temp_c: 95.0, cc_points: "De-aeration prevents enzymatic browning and vitamin C destruction." },
            { stage_number: 4, stage_name: "Hot Filling & Can Seaming", description: "Hot fill at 88°C into OTS cans/aseptic bags and seam immediately.", duration_minutes: 30, temp_c: 88.0, cc_points: "Ensure seam integrity and invert cans for lid sterilization." }
          ],
          equipment: [
            { equipment_name: "Mango Destoner & Pulper Combo", equipment_type: "Pulper", specification: "Dual stage pulper with seed ejector, 500 kg/hr", is_mandatory: 1, cost_min: 180000, cost_max: 320000 },
            { equipment_name: "Tubular Sterilizer & De-aerator", equipment_type: "Sterilizer", specification: "Continuous SS 316 pasteurizer, 300 L/hr", is_mandatory: 1, cost_min: 350000, cost_max: 700000 }
          ],
          packaging: { packaging_type: "Aseptic Bag-in-Box / OTS Lacquered Cans", material_specification: "3.1 kg OTS cans or 215 kg aseptic aluminum barrier liners", temp_min: 15.0, temp_max: 32.0, humidity_max: 70.0, shelf_life: 540, storage_instructions: "Store in dry covered warehouse on pallets." },
          market_info: { target_market: "Juice Manufacturers, Ice Cream Units, Confectionery Brands, Exports", commercial_uses: "Mango Nectar, fruit drinks, bakery jams, yogurt flavoring", demand_level: "High", quality_standards: "FSSAI Brix > 16° (Alphonso), Acidity 0.4-0.6%, Mold count zero", govt_schemes_info: "APEDA Agri-Export Zone incentives & MoFPI Mega Food Park support." }
        }
      },
      {
        product_name: "Dried Mango Leather (Aam Papad)",
        category: "Confectionery & Sweets",
        description: "Traditional sun/solar dehydrated sweet mango pulp sheet.",
        multiplier: 3.40,
        guide: {
          title: "Solar Dehydration of Mango Pulp into Fruit Leather",
          processing_method: "Solar Dehydration",
          difficulty_level: "Beginner",
          yield_pct: 22.00,
          time_hours: 14.0,
          summary: "Pulp sweetening, thin layer spreading on Teflon sheets, solar tunnel drying, and slitting.",
          source_reference: "KVK Post-Harvest Horticulture Extension Guide",
          stages: [
            { stage_number: 1, stage_name: "Pulp Formulation", description: "Blend mango pulp with 15% sugar and 0.2% citric acid.", duration_minutes: 30, temp_c: 70.0, cc_points: "Dissolve sugar completely and pasteurize batch." },
            { stage_number: 2, stage_name: "Layer Spreading & Drying", description: "Pour pulp in 3-4mm thin layers on food-grade trays in solar polyhouse dryer.", duration_minutes: 600, temp_c: 55.0, cc_points: "Maintain hygienic dust-free solar drying chamber." },
            { stage_number: 3, stage_name: "Multi-layer Stacking & Cutting", description: "Peel dried sheets, stack into layers, and cut into rectangular bars.", duration_minutes: 45, temp_c: null, cc_points: "Final product moisture 14-16% for pliable texture." }
          ],
          equipment: [
            { equipment_name: "Solar Polyhouse Tunnel Dryer", equipment_type: "Dryer", specification: "Walk-in UV stabilized solar dryer, 100 kg tray area", is_mandatory: 1, cost_min: 85000, cost_max: 160000 },
            { equipment_name: "Confectionery Sheet Cutter", equipment_type: "Cutter", specification: "SS rotary blade grid cutter", is_mandatory: 1, cost_min: 25000, cost_max: 45000 }
          ],
          packaging: { packaging_type: "Cellophane / Poly-laminated Wrapper", material_specification: "Individual wrapping in 50 micron OPP film", temp_min: 15.0, temp_max: 30.0, humidity_max: 60.0, shelf_life: 180, storage_instructions: "Keep in cool dry place; avoid direct heat source." },
          market_info: { target_market: "Retail Confectionery Stores, Highway Snack Outlets, Tourist Hubs", commercial_uses: "Direct consumer snack, traditional sweet", demand_level: "High", quality_standards: "FSSAI Moisture < 18%, Total Sugars > 60%, Free from SO2 excess", govt_schemes_info: "KVIC Rural Cottage Industry grant scheme." }
        }
      }
    ]
  },

  // 7. BANANA
  {
    crop_name: "Banana",
    products: [
      {
        product_name: "Raw Banana Chips",
        category: "Processed Foods",
        description: "Crispy fried sliced raw green bananas seasoned with salt or spices.",
        multiplier: 2.70,
        guide: {
          title: "Slicing & Frying of Green Plantain Bananas",
          processing_method: "Deep Frying & Seasoning",
          difficulty_level: "Beginner",
          yield_pct: 30.00,
          time_hours: 3.0,
          summary: "Peeling green bananas, high-speed rotary slicing directly into hot coconut/vegetable oil, salting, and nitrogen packaging.",
          source_reference: "ICAR-National Research Centre for Banana (NRCB) Processing Manual",
          stages: [
            { stage_number: 1, stage_name: "Peeling & Washing", description: "De-hand raw green bananas (Nendran variety) and peel skins under water.", duration_minutes: 30, temp_c: null, cc_points: "Submerge peeled fingers in 0.1% citric acid to prevent enzymatic blackening." },
            { stage_number: 2, stage_name: "Direct Slicing & Frying", description: "Slice 1.5mm thick wafers directly into frying kettle with refined oil.", duration_minutes: 15, temp_c: 175.0, cc_points: "Maintain oil temperature 170-180°C to prevent excessive oil absorption." },
            { stage_number: 3, stage_name: "Salting & De-oiling", description: "Pass fried chips through centrifugal de-oiler and spray brine/turmeric solution.", duration_minutes: 15, temp_c: null, cc_points: "Reduce residual oil content below 30%." }
          ],
          equipment: [
            { equipment_name: "Motorized Banana Slicer", equipment_type: "Slicer", specification: "Direct drop rotary slicer, 200 kg/hr", is_mandatory: 1, cost_min: 45000, cost_max: 80000 },
            { equipment_name: "Batch Deep Fryer with Tilting Mesh", equipment_type: "Fryer", specification: "LPG heated SS fryer with oil filter, 50 L capacity", is_mandatory: 1, cost_min: 85000, cost_max: 150000 },
            { equipment_name: "Centrifugal De-oiler", equipment_type: "De-oiler", specification: "SS basket spinner, 15 kg batch capacity", is_mandatory: 1, cost_min: 30000, cost_max: 55000 }
          ],
          packaging: { packaging_type: "Nitrogen Flushed Metallized Pouches", material_specification: "Tri-layer BOPP/Metalized PET/PE 75 micron pouch", temp_min: 15.0, temp_max: 30.0, humidity_max: 55.0, shelf_life: 120, storage_instructions: "Store in ambient conditions away from light and impact." },
          market_info: { target_market: "Snack Retail Chains, Supermarket Outlets, Export Markets", commercial_uses: "Salty snack, tea-time food product", demand_level: "High", quality_standards: "FSSAI Moisture < 3.0%, Fat < 35%, Acid value of extracted fat < 2.0", govt_schemes_info: "PMFME credit subsidy & Kerala State Industrial Development grants." }
        }
      },
      {
        product_name: "Banana Powder / Flour",
        category: "Flour & Milling",
        description: "Nutritious resistant-starch flour ground from dehydrated raw green bananas.",
        multiplier: 3.60,
        guide: {
          title: "Dehydration & Pulverizing of Green Banana Slices",
          processing_method: "Cabinet Drying & Milling",
          difficulty_level: "Intermediate",
          yield_pct: 22.00,
          time_hours: 8.0,
          summary: "Peeling green bananas, blanching, slicing, cabinet drying, and fine impact milling.",
          source_reference: "NRCB Trichy Post-Harvest Technology Protocol",
          stages: [
            { stage_number: 1, stage_name: "Steam Blanching & Slicing", description: "Steam whole raw bananas to loosen peel and slice into 3mm chips.", duration_minutes: 20, temp_c: 95.0, cc_points: "Deactivate polyphenol oxidase enzyme." },
            { stage_number: 2, stage_name: "Hot Air Tray Drying", description: "Dry banana slices at 60°C until moisture drops to 6%.", duration_minutes: 360, temp_c: 60.0, cc_points: "Prevent caramelization by avoiding temperatures > 65°C." },
            { stage_number: 3, stage_name: "Fine Milling & Sieving", description: "Pulverize dried chips into fine flour through 100 mesh screen.", duration_minutes: 40, temp_c: null, cc_points: "Maintain dry ambient atmosphere during milling." }
          ],
          equipment: [
            { equipment_name: "Hot Air Tray Dryer", equipment_type: "Dryer", specification: "96-tray SS dryer, digital temp controller", is_mandatory: 1, cost_min: 220000, cost_max: 380000 },
            { equipment_name: "Micro Pulverizer Mill", equipment_type: "Mill", specification: "SS 304 contact parts, 100 mesh output, 75 kg/hr", is_mandatory: 1, cost_min: 95000, cost_max: 170000 }
          ],
          packaging: { packaging_type: "Aluminum Foil Laminated Bags", material_specification: "100 micron tri-laminate pouch with airtight seal", temp_min: 15.0, temp_max: 30.0, humidity_max: 50.0, shelf_life: 270, storage_instructions: "Store in airtight container; highly sensitive to humidity." },
          market_info: { target_market: "Baby Food Formulators, Gluten-Free Bakery, Health Food Outlets", commercial_uses: "Gluten-free baking flour, weaning food supplement, gut-health starch", demand_level: "High", quality_standards: "FSSAI Moisture < 8.0%, Starch > 70%, Ash < 3.5%", govt_schemes_info: "NRCB Incubation Centre Support & MSME Cluster Assistance." }
        }
      }
    ]
  },

  // 8. TURMERIC
  {
    crop_name: "Turmeric",
    products: [
      {
        product_name: "Cured Turmeric Powder",
        category: "Spices & Extracts",
        description: "Vibrant yellow aromatic spice powder processed from boiled, dried, and pulverized turmeric rhizomes.",
        multiplier: 2.80,
        guide: {
          title: "Boiling, Sun/Cabinet Drying, and Pulverizing of Turmeric Rhizomes",
          processing_method: "Boiling & Pulverizing",
          difficulty_level: "Intermediate",
          yield_pct: 20.00,
          time_hours: 72.0,
          summary: "Curing raw rhizomes in boiling water, drying to 10% moisture, polishing outer skin, and multi-stage pulverizing.",
          source_reference: "ICAR-Indian Institute of Spices Research (IISR) Processing Manual",
          stages: [
            { stage_number: 1, stage_name: "Rhizome Washing & Curing", description: "Boil washed raw rhizomes in water for 45-60 mins until soft and froth rises.", duration_minutes: 60, temp_c: 100.0, cc_points: "Proper curing gelatinizes starch and yields uniform yellow color." },
            { stage_number: 2, stage_name: "Drying to Optimum Moisture", description: "Spread boiled rhizomes on clean drying yards or solar dryers for 10-15 days.", duration_minutes: 2880, temp_c: 50.0, cc_points: "Dry until rhizomes produce metallic sound when snapped (moisture < 10%)." },
            { stage_number: 3, stage_name: "Polishing Outer Skin", description: "Tumble dried rhizomes in mesh polishing drum to remove rough skin and rootlets.", duration_minutes: 45, temp_c: null, cc_points: "Achieve smooth bright yellow surface appearance." },
            { stage_number: 4, stage_name: "Pulverizing & Sieving", description: "Grind polished fingers in water-cooled pin mill to 80 mesh.", duration_minutes: 60, temp_c: 45.0, cc_points: "Cooling prevents loss of volatile turmeric oil and Curcumin." }
          ],
          equipment: [
            { equipment_name: "Steam Boiling Vessel / Cooker", equipment_type: "Cooker", specification: "Perforated SS boiling pan with steam coil, 300 kg batch", is_mandatory: 1, cost_min: 75000, cost_max: 130000 },
            { equipment_name: "Turmeric Polishing Drum", equipment_type: "Polisher", specification: "Hexagonal mesh polishing barrel, 200 kg/hr", is_mandatory: 1, cost_min: 40000, cost_max: 70000 },
            { equipment_name: "Water-Cooled Pin Mill", equipment_type: "Pulverizer", specification: "Chilled water jacket mill, 100 kg/hr output", is_mandatory: 1, cost_min: 140000, cost_max: 260000 }
          ],
          packaging: { packaging_type: "Laminated Poly-Pouches in HDPE Bags", material_specification: "100 micron light-proof PET/Met-PET/PE moisture proof pouches", temp_min: 15.0, temp_max: 30.0, humidity_max: 60.0, shelf_life: 365, storage_instructions: "Store in dark dry warehouse; sunlight bleaches curcumin color." },
          market_info: { target_market: "Spice Exporters, FMCG Brand Packers, Pharma Formulators", commercial_uses: "Culinary spice, natural food color, anti-inflammatory supplement", demand_level: "High", quality_standards: "FSSAI / Spices Board Standard: Curcumin > 3.0%, Moisture < 10%, Lead Absent", govt_schemes_info: "Spices Board Assistance & PMFME Spice Processing Scheme." }
        }
      }
    ]
  },

  // 9. CHILLI
  {
    crop_name: "Chilli",
    products: [
      {
        product_name: "Dry Red Chilli Powder",
        category: "Spices & Extracts",
        description: "Pungent red spice powder prepared by dehydrating and milling mature red chillies.",
        multiplier: 2.40,
        guide: {
          title: "Dehydration & Mechanical Grinding of Red Chillies",
          processing_method: "Dehydration & Pulverizing",
          difficulty_level: "Intermediate",
          yield_pct: 25.00,
          time_hours: 24.0,
          summary: "Stalk removal, solar/cabinet drying, impact pulverizing, and color/pungency standardized packaging.",
          source_reference: "Spices Board India & IISR Kozhikode Guidelines",
          stages: [
            { stage_number: 1, stage_name: "Destemming & Washing", description: "Remove green stalks and wash pods in water bath.", duration_minutes: 45, temp_c: null, cc_points: "Stalk removal improves powder color purity and grade." },
            { stage_number: 2, stage_name: "Solar / Hot Air Drying", description: "Dry red chillies to 8% moisture in solar tunnel dryer.", duration_minutes: 1200, temp_c: 55.0, cc_points: "Prevent color fading caused by excessive direct UV exposure." },
            { stage_number: 3, stage_name: "Two-Stage Pulverizing", description: "Coarse crush in breaker mill followed by fine grinding in pin mill.", duration_minutes: 60, temp_c: 40.0, cc_points: "Control mill heating to retain Capsaicin and ASTA color values." }
          ],
          equipment: [
            { equipment_name: "Chilli Destemming Machine", equipment_type: "Destemmer", specification: "Rotary knife destemmer, 150 kg/hr", is_mandatory: 1, cost_min: 85000, cost_max: 150000 },
            { equipment_name: "Cold-Grinding Pin Mill", equipment_type: "Mill", specification: "Water jacket cooled SS mill, 100 kg/hr", is_mandatory: 1, cost_min: 150000, cost_max: 270000 }
          ],
          packaging: { packaging_type: "Multi-layer Metallized Barrier Pouches", material_specification: "100 micron PET/Met-PET/PE for light, oxygen, and moisture barrier", temp_min: 15.0, temp_max: 30.0, humidity_max: 55.0, shelf_life: 365, storage_instructions: "Store in cool dark warehouse; keep sealed to retain pungency." },
          market_info: { target_market: "Spice Blenders, Sauce Plants, Household Retail, Exports", commercial_uses: "Culinary seasoning, oleoresin extraction, curry powders", demand_level: "High", quality_standards: "FSSAI Moisture < 10%, ASTA Color > 100, Aflatoxin < 10 ppb", govt_schemes_info: "Spices Board Quality Improvement Grant & PMFME Subsidy." }
        }
      }
    ]
  },

  // 10. GINGER
  {
    crop_name: "Ginger",
    products: [
      {
        product_name: "Dry Ginger Powder (Sonth)",
        category: "Spices & Extracts",
        description: "Pungent dried ginger rhizome powder used in traditional medicine and culinary seasonings.",
        multiplier: 3.10,
        guide: {
          title: "Washing, Peeling, Drying, and Grinding of Ginger Rhizomes",
          processing_method: "Sun/Cabinet Drying & Milling",
          difficulty_level: "Intermediate",
          yield_pct: 20.00,
          time_hours: 48.0,
          summary: "Soaking fresh ginger, mechanical unroofing/peeling, tray drying to 10% moisture, and fine grinding.",
          source_reference: "IISR Post-Harvest Ginger Processing Guide",
          stages: [
            { stage_number: 1, stage_name: "Soaking & Outer Skin Peeling", description: "Soak fresh ginger in water overnight and rub lightly to remove outer epidermal skin.", duration_minutes: 60, temp_c: null, cc_points: "Do not peel deeply; ginger essential oil glands reside near the skin surface." },
            { stage_number: 2, stage_name: "Cabinet Tray Drying", description: "Slice or place whole peeled rhizomes on trays; dry at 55°C.", duration_minutes: 1440, temp_c: 55.0, cc_points: "Dry to 9-10% moisture to prevent fungal growth." },
            { stage_number: 3, stage_name: "Pulverizing & Sieving", description: "Grind dried ginger fingers in hammer mill through 80 mesh screen.", duration_minutes: 45, temp_c: 42.0, cc_points: "Keep grinding temperature low to preserve Gingerol and Shogaol content." }
          ],
          equipment: [
            { equipment_name: "Ginger Washer & Peeler Barrel", equipment_type: "Peeler", specification: "Abrasive brush roller peeler, 300 kg/hr", is_mandatory: 1, cost_min: 65000, cost_max: 120000 },
            { equipment_name: "Hot Air Dehydrator", equipment_type: "Dryer", specification: "48-tray SS hot air cabinet dryer", is_mandatory: 1, cost_min: 160000, cost_max: 290000 }
          ],
          packaging: { packaging_type: "High-Barrier Foil Pouches", material_specification: "100 micron PET/Foil/PE moisture & aroma sealed bags", temp_min: 15.0, temp_max: 28.0, humidity_max: 60.0, shelf_life: 365, storage_instructions: "Store in cool dry spice warehouse; avoid moisture absorption." },
          market_info: { target_market: "Pharma Formulators, Tea/Beverage Blenders, Bakery Industry", commercial_uses: "Ginger tea mix, ayurvedic digestives, bakery cookies, curry powders", demand_level: "High", quality_standards: "FSSAI Moisture < 10.0%, Volatile oil > 1.5% v/w, Ash < 6.0%", govt_schemes_info: "Spices Board Development Scheme & PMFME 35% Credit Grant." }
        }
      },
      {
        product_name: "Ginger Paste",
        category: "Processed Foods",
        description: "Smooth acidified fresh ginger puree for convenient culinary cooking.",
        multiplier: 2.30,
        guide: {
          title: "Wet Grinding & Acid Preservation of Fresh Ginger",
          processing_method: "Grinding & Acid Preservation",
          difficulty_level: "Beginner",
          yield_pct: 88.00,
          time_hours: 3.0,
          summary: "Peeling fresh ginger, wet grinding with salt and citric acid, thermal blanching, and aseptic packaging.",
          source_reference: "CFTRI Extension Bulletin on Culinary Pastes",
          stages: [
            { stage_number: 1, stage_name: "Cleaning & Fine Chopping", description: "Wash fresh ginger, peel skin, and chop into small bits.", duration_minutes: 30, temp_c: null, cc_points: "Ensure 0% dirt/soil residue on fresh rhizomes." },
            { stage_number: 2, stage_name: "Wet Grinding & Acidification", description: "Grind ginger with 8% salt, 1.2% citric acid, and 0.1% sodium benzoate.", duration_minutes: 30, temp_c: null, cc_points: "Adjust batch pH strictly below 4.0 to prevent Clostridium botulinum risk." },
            { stage_number: 3, stage_name: "Thermal Pasteurization & Filling", description: "Heat paste to 85°C and fill into sterile glass/laminated pouches.", duration_minutes: 30, temp_c: 85.0, cc_points: "Maintain hot fill temperature > 80°C." }
          ],
          equipment: [
            { equipment_name: "Industrial Wet Grinder / Cutter", equipment_type: "Grinder", specification: "SS 304 bowl chopper / wet grinder, 100 kg/hr", is_mandatory: 1, cost_min: 85000, cost_max: 160000 },
            { equipment_name: "Jacketed Mixing Kettle", equipment_type: "Kettle", specification: "Steam jacketed tilting kettle with agitator, 100L", is_mandatory: 1, cost_min: 95000, cost_max: 180000 }
          ],
          packaging: { packaging_type: "Laminated Squeeze Pouches / Glass Jars", material_specification: "200g multi-layer barrier stand-up pouch with spout", temp_min: 10.0, temp_max: 28.0, humidity_max: 65.0, shelf_life: 180, storage_instructions: "Store in ambient cool place; refrigerate after opening seal." },
          market_info: { target_market: "Domestic Retail Consumers, Restaurants, Ready-to-Eat Meal Plants", commercial_uses: "Curry gravies, marinades, meat seasonings", demand_level: "High", quality_standards: "FSSAI pH < 4.0, Salt 8-10%, Preservative Benzoate < 250 ppm", govt_schemes_info: "MoFPI Micro Food Enterprise Subsidy." }
        }
      }
    ]
  },

  // 11. ONION
  {
    crop_name: "Onion",
    products: [
      {
        product_name: "Dehydrated Onion Flakes & Powder",
        category: "Dehydrated Produce",
        description: "Shelf-stable white or red onion flakes produced by hot-air dehydration.",
        multiplier: 3.70,
        guide: {
          title: "Controlled Hot-Air Dehydration of Onion Slices",
          processing_method: "Hot Air Cabinet Drying",
          difficulty_level: "Intermediate",
          yield_pct: 10.00,
          time_hours: 12.0,
          summary: "Top-tailing onions, peeling outer dry skin, uniform slicing, multi-stage hot air drying, and kibbling/milling.",
          source_reference: "ICAR-Directorate of Onion and Garlic Research (DOGR) Guidelines",
          stages: [
            { stage_number: 1, stage_name: "De-skinning & Slicing", description: "Remove root, stem, and outer paper skin; slice bulb into 3mm rings.", duration_minutes: 45, temp_c: null, cc_points: "Use cultivars with high total soluble solids (TSS > 15° Brix)." },
            { stage_number: 2, stage_name: "First Stage Drying", description: "Dry onion slices at 65°C for 4 hours.", duration_minutes: 240, temp_c: 65.0, cc_points: "High initial air velocity to remove surface moisture rapidly." },
            { stage_number: 3, stage_name: "Second Stage Drying", description: "Finish drying at 55°C until final moisture reaches 4.5%.", duration_minutes: 360, temp_c: 55.0, cc_points: "Do not exceed 60°C in second stage to avoid pinkish color defect." }
          ],
          equipment: [
            { equipment_name: "Automatic Onion Peeler & Root Cutter", equipment_type: "Peeler", specification: "Air jet onion skin peeler, 300 kg/hr", is_mandatory: 1, cost_min: 120000, cost_max: 220000 },
            { equipment_name: "Continuous Conveyor Belt Dryer", equipment_type: "Dryer", specification: "Tri-stage perforated belt dryer, 250 kg/hr input", is_mandatory: 1, cost_min: 650000, cost_max: 1400000 }
          ],
          packaging: { packaging_type: "Aluminum Foil Laminated Pouches in Fiber Drums", material_specification: "125 micron 4-ply foil bag sealed inside corrugated fiber drum", temp_min: 15.0, temp_max: 28.0, humidity_max: 45.0, shelf_life: 365, storage_instructions: "Extremely hygroscopic; store in low-humidity air-conditioned space." },
          market_info: { target_market: "Dehydrated Export Houses, Instant Noodle/Soup Plants, Seasoning Units", commercial_uses: "Sauces, dry seasonings, canned soups, convenience foods", demand_level: "High", quality_standards: "FSSAI / ISO Standard: Moisture < 5.0%, Pyruvic acid retained, Ash < 4.5%", govt_schemes_info: "DOGR Processing Incubation Centre & APEDA Dehydration Subsidies." }
        }
      }
    ]
  },

  // 12. MILLETS
  {
    crop_name: "Millets",
    products: [
      {
        product_name: "Ragi (Finger Millet) Flour & Malt",
        category: "Flour & Milling",
        description: "Nutritious germinated finger millet powder rich in calcium, iron, and dietary fiber.",
        multiplier: 2.60,
        guide: {
          title: "Germination, Malting, and Milling of Finger Millet (Ragi)",
          processing_method: "Germination & Milling",
          difficulty_level: "Intermediate",
          yield_pct: 82.00,
          time_hours: 48.0,
          summary: "Soaking ragi grains, 24-hour germination, kiln drying, light roasting, and pin milling.",
          source_reference: "ICAR-Indian Institute of Millets Research (IIMR) Nutri-Cereal Guide",
          stages: [
            { stage_number: 1, stage_name: "Steeping & Germination", description: "Soak washed ragi grains in water for 12 hours and sprout in gunny bags for 24 hours.", duration_minutes: 2160, temp_c: 25.0, cc_points: "Sprouting synthesizes amylase enzymes and enhances bioavailability of iron & calcium." },
            { stage_number: 2, stage_name: "Kiln Drying & Light Roasting", description: "Dry sprouted grains at 60°C and gently roast to develop malt aroma.", duration_minutes: 180, temp_c: 70.0, cc_points: "Roasting inactivates lipases and imparts pleasant nutty flavor." },
            { stage_number: 3, stage_name: "De-shooting & Fine Milling", description: "Rub off vegetative sprouts and pulverize malted grains into fine flour (100 mesh).", duration_minutes: 60, temp_c: null, cc_points: "Sieve thoroughly to achieve smooth baby-food consistency." }
          ],
          equipment: [
            { equipment_name: "Automatic Grain Steeping & Germination Vessel", equipment_type: "Germinator", specification: "Stainless steel aeration steep tank, 200 kg batch", is_mandatory: 1, cost_min: 85000, cost_max: 160000 },
            { equipment_name: "Grain Roasting & Kilning Drum", equipment_type: "Roaster", specification: "Rotary jacketed roaster, 100 kg/hr", is_mandatory: 1, cost_min: 75000, cost_max: 140000 },
            { equipment_name: "Stainless Steel Pin Mill", equipment_type: "Mill", specification: "100 mesh fine grinder, 80 kg/hr", is_mandatory: 1, cost_min: 95000, cost_max: 170000 }
          ],
          packaging: { packaging_type: "Nitrogen Flushed Foil Pouches", material_specification: "100 micron PET/Met-PET/PE moisture proof barrier bags", temp_min: 15.0, temp_max: 30.0, humidity_max: 60.0, shelf_life: 270, storage_instructions: "Store in cool dry place away from moisture and pests." },
          market_info: { target_market: "Health Conscious Consumers, Infant Food Sector, Diabetic Food Brands", commercial_uses: "Porridge mix, malted milk beverages, health drinks, bakery biscuits", demand_level: "High", quality_standards: "FSSAI Moisture < 10.0%, Calcium > 300 mg/100g, Protein > 7.0%", govt_schemes_info: "National Millet Mission & IIMR Nutrihub Incubation Grants." }
        }
      },
      {
        product_name: "Millet Flakes",
        category: "Processed Foods",
        description: "Flattened nutrient-dense flakes prepared from pearl millet (Bajra) or sorghum (Jowar).",
        multiplier: 3.10,
        guide: {
          title: "Conditioning, Steaming, and Flaking of Whole Millets",
          processing_method: "Thermal Flaking",
          difficulty_level: "Intermediate",
          yield_pct: 78.00,
          time_hours: 6.0,
          summary: "Dehulling grains, steam conditioning, heavy-duty roller flaking, and hot-air drying.",
          source_reference: "IIMR Hyderabad Processing Technology Bulletin",
          stages: [
            { stage_number: 1, stage_name: "Grain Dehulling", description: "Pass millet grains through abrasive disc dehusker to remove outer seed coat.", duration_minutes: 45, temp_c: null, cc_points: "Retain inner bran layer for dietary fiber enrichment." },
            { stage_number: 2, stage_name: "Steam Conditioning", description: "Subject dehulled grain to live steam to soften endosperm.", duration_minutes: 30, temp_c: 100.0, cc_points: "Increase grain moisture to 18-20% for elastic flaking." },
            { stage_number: 3, stage_name: "Heavy Roller Flaking & Drying", description: "Pass hot steamed grains between smooth heavy chilled rolls and dry flakes to 8% moisture.", duration_minutes: 60, temp_c: 65.0, cc_points: "Maintain uniform roll pressure for thin crispy flake thickness (0.4mm)." }
          ],
          equipment: [
            { equipment_name: "Millet Dehusker / Polisher", equipment_type: "Dehusker", specification: "Abrasive wheel dehusker, 250 kg/hr", is_mandatory: 1, cost_min: 65000, cost_max: 120000 },
            { equipment_name: "Heavy Duty Flaking Mill", equipment_type: "Flaker", specification: "Chilled iron roller flaker, 200 kg/hr", is_mandatory: 1, cost_min: 220000, cost_max: 420000 }
          ],
          packaging: { packaging_type: "Nitrogen Puffed Metallic Pouches", material_specification: "80 micron BOPP/Met-PET/PE moisture and crunchiness seal bag", temp_min: 15.0, temp_max: 30.0, humidity_max: 55.0, shelf_life: 180, storage_instructions: "Store in ambient warehouse; avoid crushing under heavy stacks." },
          market_info: { target_market: "Breakfast Cereal Brands, Organic Retail, Snack Mix Packers", commercial_uses: "Ready-to-eat muesli, millet poha, roasted snack mixtures", demand_level: "High", quality_standards: "FSSAI Moisture < 8.0%, Crude Fiber > 4.0%, Flake thickness 0.3-0.5mm", govt_schemes_info: "PMFME Millet Cluster Development 35% Subsidy." }
        }
      }
    ]
  },

  // 13. PULSES
  {
    crop_name: "Pulses",
    products: [
      {
        product_name: "Besan (Gram Flour)",
        category: "Flour & Milling",
        description: "Fine yellow pulse flour milled from dehulled Bengal gram (chana dal).",
        multiplier: 1.80,
        guide: {
          title: "Dehusking, Splitting, and Milling of Bengal Gram",
          processing_method: "Dry Pulverizing & Sieving",
          difficulty_level: "Beginner",
          yield_pct: 75.00,
          time_hours: 4.0,
          summary: "Conditioning raw chickpeas, dehusking & splitting into dal, impact pulverizing, and fine sieving.",
          source_reference: "ICAR-Indian Institute of Pulses Research (IIPR) Processing Manual",
          stages: [
            { stage_number: 1, stage_name: "Oil-Water Conditioning & Dehusking", description: "Treat raw chana with 0.5% edible oil and water, sun dry, and pass through emery mill to husk & split.", duration_minutes: 120, temp_c: null, cc_points: "Ensure complete removal of fibrous husk." },
            { stage_number: 2, stage_name: "Impact Pulverizing", description: "Grind clean chana dal in high-speed impact mill.", duration_minutes: 45, temp_c: 40.0, cc_points: "Prevent thermal protein denaturation during grinding." },
            { stage_number: 3, stage_name: "Sifting & Grading", description: "Pass ground flour through 80 mesh gyro screen.", duration_minutes: 30, temp_c: null, cc_points: "Check for zero bran/husk particle carryover." }
          ],
          equipment: [
            { equipment_name: "Pulse Dehusker & Splitter Mill", equipment_type: "Dehusker", specification: "Emery roll pulse mill, 500 kg/hr", is_mandatory: 1, cost_min: 140000, cost_max: 280000 },
            { equipment_name: "Heavy Duty Impact Pulverizer", equipment_type: "Grinder", specification: "SS contact parts, 200 kg/hr, 10 HP motor", is_mandatory: 1, cost_min: 110000, cost_max: 210000 }
          ],
          packaging: { packaging_type: "HDPE Laminated Pouches", material_specification: "80 micron food grade LDPE/PP pouch", temp_min: 15.0, temp_max: 30.0, humidity_max: 60.0, shelf_life: 180, storage_instructions: "Store on wooden pallets in dry pest-controlled environment." },
          market_info: { target_market: "Sweet Shops, Snack Manufacturers, Retail Grocery Outlets", commercial_uses: "Traditional sweets (soan papdi, laddoo), fried snacks (pakora, bhujia)", demand_level: "High", quality_standards: "FSSAI Moisture < 11.5%, Protein > 20%, Free from adulterants (Khesari dal)", govt_schemes_info: "IIPR Technology Transfer & PMFME Processing Support." }
        }
      }
    ]
  },

  // 14. SUGARCANE
  {
    crop_name: "Sugarcane",
    products: [
      {
        product_name: "Jaggery (Gur) & Jaggery Powder",
        category: "Confectionery & Sweets",
        description: "Unrefined traditional natural sweetener produced by boiling clarified sugarcane juice.",
        multiplier: 2.50,
        guide: {
          title: "Juice Clarification, Open Pan Evaporation, and Granulation of Jaggery",
          processing_method: "Open Pan Evaporation",
          difficulty_level: "Intermediate",
          yield_pct: 12.00,
          time_hours: 5.0,
          summary: "Sugarcane crushing, organic herbal clarification, open pan concentration to 118°C, striking, cooling, and powdering.",
          source_reference: "ICAR-Sugarcane Breeding Institute (SBI) & IISR Lucknow Jaggery Manual",
          stages: [
            { stage_number: 1, stage_name: "Juice Extraction & Filtering", description: "Crush fresh sugarcane in 3-roller mill and filter raw juice through fine screen.", duration_minutes: 30, temp_c: null, cc_points: "Extract juice within 6 hours of harvest to prevent sucrose inversion." },
            { stage_number: 2, stage_name: "Herbal Clarification", description: "Heat juice in open boiling pan and add Bhendi (Ladyfinger) mucilage extract to remove scum.", duration_minutes: 45, temp_c: 90.0, cc_points: "Use natural herbal clarificants instead of harmful sodium hydrosulfite chemicals." },
            { stage_number: 3, stage_name: "High Temperature Concentration", description: "Boil clarified juice vigorously until temperature reaches striking point (118-120°C).", duration_minutes: 120, temp_c: 118.0, cc_points: "Monitor striking temperature precisely for solid jaggery formation." },
            { stage_number: 4, stage_name: "Cooling & Granulation", description: "Transfer hot semi-solid slurry to wooden cooling trough and knead with wooden scrapers into powder.", duration_minutes: 45, temp_c: 45.0, cc_points: "Knead continuously to form uniform dry granules." }
          ],
          equipment: [
            { equipment_name: "3-Roller Sugarcane Crusher Mill", equipment_type: "Crusher", specification: "Heavy duty 3-roller crusher, 500 kg cane/hr", is_mandatory: 1, cost_min: 85000, cost_max: 160000 },
            { equipment_name: "Triple Boiling Pan Furnace Set", equipment_type: "Boiler", specification: "Bagasse-fired flue gas efficient open pans, SS 304 pans", is_mandatory: 1, cost_min: 120000, cost_max: 240000 },
            { equipment_name: "Jaggery Granulator & Sifter", equipment_type: "Granulator", specification: "SS rotary blade granulator, 150 kg/hr", is_mandatory: 1, cost_min: 45000, cost_max: 85000 }
          ],
          packaging: { packaging_type: "Airtight PET Jars / Laminated Pouches", material_specification: "100 micron moisture-proof barrier pouches or PET wide-mouth containers", temp_min: 15.0, temp_max: 28.0, humidity_max: 50.0, shelf_life: 270, storage_instructions: "Highly hygroscopic; store in airtight containers in dry room." },
          market_info: { target_market: "Health-Conscious Retail Consumers, Organic Stores, Export Outlets", commercial_uses: "Natural coffee/tea sweetener, traditional desserts, ayurvedic formulations", demand_level: "High", quality_standards: "FSSAI Sucrose > 70%, Moisture < 4.0%, SO2 Nil in organic grade", govt_schemes_info: "IISR Lucknow Jaggery Incubation & KVIC Cottage Industry Scheme." }
        }
      }
    ]
  },

  // 15. AMLA
  {
    crop_name: "Amla",
    products: [
      {
        product_name: "Amla Juice & Concentrate",
        category: "Beverages",
        description: "Vitamin-C rich antioxidant juice pressed from fresh Indian gooseberries.",
        multiplier: 3.20,
        guide: {
          title: "Cold Pressing & Pasteurization of Amla Fruits",
          processing_method: "Cold Pressing & Pasteurization",
          difficulty_level: "Beginner",
          yield_pct: 50.00,
          time_hours: 3.0,
          summary: "Washing amla fruits, destoning, hydraulic cold pressing, filtration, pasteurization, and glass bottling.",
          source_reference: "ICAR-Central Institute for Arid Horticulture (CIAH) Processing Protocol",
          stages: [
            { stage_number: 1, stage_name: "Washing & Seed Removal", description: "Wash ripe amla fruits and pass through amla seed remover / segmenter.", duration_minutes: 30, temp_c: null, cc_points: "Remove hard central stone cleanly without crushing seed kernel." },
            { stage_number: 2, stage_name: "Cold Hydraulic Pressing", description: "Press pulp segments in hydraulic filter press to extract clear juice.", duration_minutes: 45, temp_c: null, cc_points: "Avoid contact with iron metals which cause juice blackening." },
            { stage_number: 3, stage_name: "Thermal Pasteurization & Bottling", description: "Heat juice with 0.1% potassium metabisulfite at 85°C for 15 mins and hot fill into sterilised bottles.", duration_minutes: 30, temp_c: 85.0, cc_points: "Fill hot (> 80°C) to prevent vitamin C loss and microbial spoilage." }
          ],
          equipment: [
            { equipment_name: "Amla Destoner / Shredder Machine", equipment_type: "Destoner", specification: "SS 304 amla seed remover, 300 kg/hr", is_mandatory: 1, cost_min: 75000, cost_max: 140000 },
            { equipment_name: "Hydraulic Juice Press", equipment_type: "Press", specification: "Food grade SS 304 hydraulic basket press, 100 L/batch", is_mandatory: 1, cost_min: 110000, cost_max: 220000 }
          ],
          packaging: { packaging_type: "Amber Glass Bottles / Food-Grade PET", material_specification: "500ml / 1000ml UV-protected amber glass bottles with crown cap", temp_min: 10.0, temp_max: 25.0, humidity_max: 65.0, shelf_life: 270, storage_instructions: "Store in cool dark warehouse; refrigerate after opening lid." },
          market_info: { target_market: "Ayurvedic Health Brands, Wellness Stores, Supermarket Chains", commercial_uses: "Daily immunity booster shot, health drink blends, cosmetic tonics", demand_level: "High", quality_standards: "FSSAI Ascorbic Acid (Vit C) > 500 mg/100g, Acidity 2.0-3.0%, TSS > 8°", govt_schemes_info: "National Medicinal Plants Board (NMPB) & PMFME Processing Grant." }
        }
      },
      {
        product_name: "Amla Candy",
        category: "Confectionery & Sweets",
        description: "Sweet and tangy dehydrated amla segments cured in sugar syrup.",
        multiplier: 3.50,
        guide: {
          title: "Osmotic Dehydration & Sugar Curing of Amla Segments",
          processing_method: "Sugar Syrup Osmotic Dehydration",
          difficulty_level: "Intermediate",
          yield_pct: 40.00,
          time_hours: 72.0,
          summary: "Pricking amla fruits, steam blanching, segmenting, step-up sugar syrup osmotic equilibration (50-70° Brix), tray drying, and dusting.",
          source_reference: "CIAH Bikaner & CFTRI Post-Harvest Series",
          stages: [
            { stage_number: 1, stage_name: "Steam Blanching & Segmenting", description: "Steam amla fruits for 10 minutes to open segments and remove seeds easily.", duration_minutes: 20, temp_c: 100.0, cc_points: "Do not over-boil to avoid loss of Vitamin C." },
            { stage_number: 2, stage_name: "Osmotic Sugar Equilibration", description: "Steep segments in 50° Brix sugar syrup on Day 1, increase to 60° Brix on Day 2, and 70° Brix on Day 3.", duration_minutes: 2880, temp_c: null, cc_points: "Gradual step-up syrup concentration prevents shriveling." },
            { stage_number: 3, stage_name: "Drainage & Hot Air Drying", description: "Drain excess syrup and dry segments in cabinet dryer at 55°C for 8 hours.", duration_minutes: 480, temp_c: 55.0, cc_points: "Final moisture 15% for chewy non-sticky candy texture." }
          ],
          equipment: [
            { equipment_name: "Steam Blancher Kettle", equipment_type: "Blancher", specification: "SS 304 steam jacketed tilting kettle, 150L", is_mandatory: 1, cost_min: 85000, cost_max: 150000 },
            { equipment_name: "Osmotic Syrup Tank Set", equipment_type: "Tank", specification: "Set of 3 SS 304 syrup equilibration tanks with pumps", is_mandatory: 1, cost_min: 95000, cost_max: 180000 },
            { equipment_name: "Hot Air Cabinet Tray Dryer", equipment_type: "Dryer", specification: "48-tray SS recirculating hot air dryer", is_mandatory: 1, cost_min: 160000, cost_max: 290000 }
          ],
          packaging: { packaging_type: "Stand-up Zipper Pouches / PET Jars", material_specification: "250g / 500g laminated re-sealable zip pouch", temp_min: 15.0, temp_max: 30.0, humidity_max: 55.0, shelf_life: 365, storage_instructions: "Store in cool dry place; keep zip lock tightly closed." },
          market_info: { target_market: "Health Snack Outlets, Confectionery Retail, Travel Snacks", commercial_uses: "Digestive candy, natural vitamin C chewable, traditional sweet", demand_level: "High", quality_standards: "FSSAI Moisture < 15.0%, Total Soluble Solids > 68°, Vit C > 250 mg/100g", govt_schemes_info: "KVIC Cottage Industry Support & PMFME 35% Credit Grant." }
        }
      }
    ]
  },

  // 16. TAMARIND
  {
    crop_name: "Tamarind",
    products: [
      {
        product_name: "Seedless Tamarind Concentrate & Paste",
        category: "Processed Foods",
        description: "Viscous sour paste extracted from ripe tamarind pulp, widely used as a culinary acidulant.",
        multiplier: 2.90,
        guide: {
          title: "Hot Water Extraction & Vacuum Evaporation of Tamarind Pulp",
          processing_method: "Hot Water Extraction & Evaporation",
          difficulty_level: "Intermediate",
          yield_pct: 45.00,
          time_hours: 6.0,
          summary: "Deseeding ripe tamarind, hot water extraction of tartaric acid pulp, fiber straining, vacuum concentration to 65° Brix, and hot filling.",
          source_reference: "CFTRI Mysore Technology Transfer Manual on Tamarind Processing",
          stages: [
            { stage_number: 1, stage_name: "Deseeding & Fiber Removal", description: "Pass dry tamarind pods through mechanical deseeder to remove seeds and hard fiber.", duration_minutes: 45, temp_c: null, cc_points: "Remove 100% of seeds to prevent mill damage during extraction." },
            { stage_number: 2, stage_name: "Hot Water Extraction & Pulp Straining", description: "Digest deseeded pulp in boiling water (1:3 ratio) and pass through rotary strainer.", duration_minutes: 90, temp_c: 90.0, cc_points: "Extract maximum natural Tartaric Acid and soluble solids." },
            { stage_number: 3, stage_name: "Vacuum Concentration & Hot Filling", description: "Concentrate strained extract in vacuum evaporator to 60-65° Brix and hot fill into bottles/pouches.", duration_minutes: 120, temp_c: 65.0, cc_points: "High natural acidity (pH ~ 2.5) provides self-preservation." }
          ],
          equipment: [
            { equipment_name: "Mechanical Tamarind Deseeder", equipment_type: "Deseeder", specification: "Impact roller deseeder, 200 kg/hr", is_mandatory: 1, cost_min: 75000, cost_max: 130000 },
            { equipment_name: "SS Digestion & Extraction Kettle", equipment_type: "Extractor", specification: "Steam jacketed kettle with scraper agitator, 300L", is_mandatory: 1, cost_min: 120000, cost_max: 220000 },
            { equipment_name: "Single Effect Vacuum Evaporator", equipment_type: "Evaporator", specification: "SS 316 vacuum concentrator, 200 L/hr", is_mandatory: 1, cost_min: 280000, cost_max: 550000 }
          ],
          packaging: { packaging_type: "Glass Jars / High-Barrier PET Bottles", material_specification: "300g / 1kg food-grade PET or glass jar with acid-resistant cap liner", temp_min: 15.0, temp_max: 32.0, humidity_max: 65.0, shelf_life: 540, storage_instructions: "Store in ambient conditions; naturally self-preserving due to high tartaric acid." },
          market_info: { target_market: "Food Processing Plants, Sauce Manufacturers, Domestic Retail, Exports", commercial_uses: "Sauce base, Worcestershire sauce ingredient, curry acidulant, chutney", demand_level: "High", quality_standards: "FSSAI Total Soluble Solids > 60° Brix, Tartaric Acid > 12%, pH 2.2-2.8", govt_schemes_info: "TRIFED Tribal Forest Produce Scheme & PMFME Processing Grant." }
        }
      }
    ]
  }
];

async function seedValueAdditionDatabase() {
  console.log("======================================================================");
  console.log("      SEEDING VALUE ADDITION KNOWLEDGE DATASET (AUTHORITATIVE)        ");
  console.log("======================================================================");

  try {
    await initDatabase();

    let cropsInserted = new Set();
    let productsCount = 0;
    let methodsSet = new Set();
    let guidesCount = 0;
    let stagesCount = 0;
    let equipmentCount = 0;
    let packagingCount = 0;
    let marketCount = 0;

    const timestamp = new Date().toISOString();

    for (const cropData of dataset) {
      cropsInserted.add(cropData.crop_name);

      for (const prodData of cropData.products) {
        // 1. Insert or update crop_value_added_products
        const vapId = `vap_${cropData.crop_name.toLowerCase().replace(/\s+/g, "_")}_${prodData.product_name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

        await pool.query(
          `INSERT INTO crop_value_added_products
           (id, crop_name, product_name, category, description, value_addition_multiplier, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           category=VALUES(category), description=VALUES(description),
           value_addition_multiplier=VALUES(value_addition_multiplier), updated_at=VALUES(updated_at)`,
          [
            vapId,
            cropData.crop_name,
            prodData.product_name,
            prodData.category,
            prodData.description,
            prodData.multiplier,
            timestamp,
            timestamp
          ]
        );
        productsCount++;

        // 2. Insert processing_guides
        const guide = prodData.guide;
        const guideId = `guide_${vapId}`;
        methodsSet.add(guide.processing_method);

        await pool.query(
          `INSERT INTO processing_guides
           (id, value_added_product_id, title, processing_method, difficulty_level, expected_yield_percentage, processing_time_hours, summary, source_reference, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           title=VALUES(title), processing_method=VALUES(processing_method), difficulty_level=VALUES(difficulty_level),
           expected_yield_percentage=VALUES(expected_yield_percentage), processing_time_hours=VALUES(processing_time_hours),
           summary=VALUES(summary), source_reference=VALUES(source_reference), updated_at=VALUES(updated_at)`,
          [
            guideId,
            vapId,
            guide.title,
            guide.processing_method,
            guide.difficulty_level,
            guide.yield_pct,
            guide.time_hours,
            guide.summary,
            guide.source_reference,
            timestamp,
            timestamp
          ]
        );
        guidesCount++;

        // Clear existing child records for clean idempotent seeding
        await pool.query(`DELETE FROM processing_stages WHERE guide_id = ?`, [guideId]);
        await pool.query(`DELETE FROM processing_equipment WHERE guide_id = ?`, [guideId]);
        await pool.query(`DELETE FROM processing_packaging_storage WHERE guide_id = ?`, [guideId]);
        await pool.query(`DELETE FROM processing_market_info WHERE guide_id = ?`, [guideId]);

        // 3. Insert processing_stages
        for (const stage of guide.stages) {
          const stageId = `stg_${guideId}_${stage.stage_number}`;
          await pool.query(
            `INSERT INTO processing_stages
             (id, guide_id, stage_number, stage_name, description, duration_minutes, temperature_celsius, critical_control_points, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              stageId,
              guideId,
              stage.stage_number,
              stage.stage_name,
              stage.description,
              stage.duration_minutes,
              stage.temp_c,
              stage.cc_points,
              timestamp
            ]
          );
          stagesCount++;
        }

        // 4. Insert processing_equipment
        let equipIndex = 1;
        for (const eq of guide.equipment) {
          const eqId = `eq_${guideId}_${equipIndex++}`;
          await pool.query(
            `INSERT INTO processing_equipment
             (id, guide_id, equipment_name, equipment_type, processing_method, applicable_crops, applicable_products, purpose, capacity_info, operational_description, maintenance_considerations, source_reference, specification, is_mandatory, estimated_cost_min, estimated_cost_max, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              eqId,
              guideId,
              eq.equipment_name,
              eq.equipment_type || "Processing Machinery",
              eq.processing_method || guide.processing_method,
              eq.applicable_crops || cropData.crop_name,
              eq.applicable_products || prodData.product_name,
              eq.purpose || `Equipment for ${guide.processing_method} of ${cropData.crop_name} into ${prodData.product_name}`,
              eq.capacity_info || eq.specification || "Standard Commercial Batch Capacity",
              eq.operational_description || `Operate according to ICAR/CFTRI standard operating procedures for ${eq.equipment_name}.`,
              eq.maintenance_considerations || "Clean contact surfaces with food-grade detergent after batch operation. Lubricate moving drives monthly.",
              eq.source_reference || guide.source_reference,
              eq.specification,
              eq.is_mandatory,
              eq.cost_min,
              eq.cost_max,
              timestamp
            ]
          );
          equipmentCount++;
        }

        // 5. Insert processing_packaging_storage
        const pkg = guide.packaging;
        const pkgId = `pkg_${guideId}`;
        const suitableMat = pkg.suitable_packaging_material || pkg.material_specification || "Food-grade container";
        const pkgCons = pkg.packaging_considerations || "Ensure hermetic sealing, light protection, and barrier against oxygen/moisture ingress.";
        const labelCons = pkg.labelling_considerations || "Declare product name, net content, batch/lot number, date of packing, storage directions, and manufacturer details.";
        const storeCond = pkg.storage_conditions || pkg.storage_instructions || "Store in a cool, dry, well-ventilated space on raised dunnage away from heat sources.";
        const moistCons = pkg.moisture_considerations || (pkg.humidity_max ? `Maintain relative humidity under ${pkg.humidity_max}% to prevent moisture pick-up.` : "Protect from ambient humidity and direct moisture exposure.");
        const tempCons = pkg.temperature_considerations || (pkg.temp_min !== undefined && pkg.temp_max !== undefined ? `Maintain storage temperature between ${pkg.temp_min}°C and ${pkg.temp_max}°C.` : "Store under controlled ambient conditions.");
        const shelfLifeStr = pkg.shelf_life ? `${pkg.shelf_life} Days (${Math.round(pkg.shelf_life / 30)} Months) under recommended sealed storage conditions` : null;
        const storePrec = pkg.storage_precautions || "Stack on clean wooden pallets off concrete floors; protect from pest ingress and direct sunlight.";
        const pkgSourceRef = pkg.source_reference || guide.source_reference || "Authoritative Post-Harvest Technology Standards (CFTRI / ICAR / TNAU / KVK)";

        await pool.query(
          `INSERT INTO processing_packaging_storage
           (id, guide_id, packaging_type, material_specification, suitable_packaging_material, packaging_considerations, labelling_considerations, storage_conditions, moisture_considerations, temperature_considerations, storage_temperature_min_c, storage_temperature_max_c, humidity_percentage_max, shelf_life_days, shelf_life_info, storage_instructions, storage_precautions, source_reference, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pkgId,
            guideId,
            pkg.packaging_type,
            pkg.material_specification,
            suitableMat,
            pkgCons,
            labelCons,
            storeCond,
            moistCons,
            tempCons,
            pkg.temp_min,
            pkg.temp_max,
            pkg.humidity_max,
            pkg.shelf_life,
            shelfLifeStr,
            pkg.storage_instructions,
            storePrec,
            pkgSourceRef,
            timestamp
          ]
        );
        packagingCount++;

        // 6. Insert processing_market_info
        const mkt = guide.market_info;
        const mktId = `mkt_${guideId}`;
        await pool.query(
          `INSERT INTO processing_market_info
           (id, guide_id, target_market, commercial_uses, demand_level, quality_standards, govt_schemes_info, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mktId,
            guideId,
            mkt.target_market,
            mkt.commercial_uses,
            mkt.demand_level,
            mkt.quality_standards,
            mkt.govt_schemes_info,
            timestamp
          ]
        );
        marketCount++;
      }
    }

    console.log("\n======================================================================");
    console.log("         SEEDING COMPLETE! EXACT KNOWLEDGE STATISTICS                 ");
    console.log("======================================================================");
    console.log(`- Number of crops:                   ${cropsInserted.size}`);
    console.log(`- Number of value-added products:   ${productsCount}`);
    console.log(`- Number of processing methods:     ${methodsSet.size}`);
    console.log(`- Number of processing guides:      ${guidesCount}`);
    console.log(`- Number of processing stages:      ${stagesCount}`);
    console.log(`- Number of equipment records:       ${equipmentCount}`);
    console.log(`- Number of packaging/storage recs:  ${packagingCount}`);
    console.log(`- Number of market info records:     ${marketCount}`);
    console.log("======================================================================\n");
  } catch (err) {
    console.error("❌ Seeding Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedValueAdditionDatabase();

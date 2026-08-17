const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

    // ── App Version & Changelog ────────────────────────────────────────────────
    const APP_VERSION = 'v1.3.0';
    const CHANGELOG = [
        {
            version: 'v1.3.0',
            date: '2026-08-16',
            notes: [
                'Added FDM vs SLA printer type selection with color-coded badges',
                'SLA resin cost engine: calculates from volume (mL) not mass (g)',
                'Material database now tracks type: Filament (FDM) or Resin (SLA)',
                'Filament/Material tab now has FDM / SLA / All filter tabs',
                'Resin seed data added: Standard, ABS-Like, and Water-Washable resins',
                'SLA seed printers added: Elegoo Mars 4, Anycubic Photon Mono X2',
                'Material modal adapts fields based on type (spool weight vs bottle mL)',
            ]
        },
        {
            version: 'v1.2.0',
            date: '2026-08-16',
            notes: [
                'Added .3MF file format support alongside .STL',
                'Multi-filament detection: auto-reads color channels from .3MF metadata',
                'Filament tab now uses checkboxes for multi-filament selection',
                'Filament cost calculation averages across all selected filaments',
                'Version number now clickable — opens this changelog',
                'Active filament summary bar with quick-remove controls',
                'File type badge shown in 3D Viewer and Dashboard workflow',
            ]
        },
        {
            version: 'v1.1.0',
            date: '2026-08-01',
            notes: [
                'Multi-Color printer badge in Printer Database',
                'Slicer data override section for 100% accurate cost estimation',
                'Dashboard cost breakdown cards',
                'Dark mode toggle',
                'PDF export via jsPDF',
            ]
        },
        {
            version: 'v1.0.0',
            date: '2026-07-15',
            notes: [
                'Initial standalone release',
                'STL file upload & 3D viewer (Three.js)',
                'Printer and Filament databases (IndexedDB / Dexie)',
                'Cost calculator: electricity, machine depreciation, labor, overhead',
                'Profit margin / markup pricing strategy',
                'Quotation PDF generation',
            ]
        }
    ];

    // Color palette for multi-filament swatches
    const SWATCH_PALETTE = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316'];

    // ── Database Setup ─────────────────────────────────────────────────────────
    const db = new Dexie('3DPrintCalcDB');
    db.version(2).stores({
        printers: '++id, brand, model, printerType',
        filaments: '++id, materialName, brand, materialType',
        settings: 'id' // singleton
    });

    // Seed Data
    const defaultPrinters = [
        // FDM
        { printerType: 'FDM', brand: 'Bambu Lab', model: 'A1 mini', buildVolume: {x: 180, y: 180, z: 180}, averagePowerWatts: 100, maximumPowerWatts: 150, purchasePrice: 15000, expectedLifetimeHours: 5000, maintenanceCostPerHour: 0.5, isMulticolor: true },
        { printerType: 'FDM', brand: 'Bambu Lab', model: 'P1S', buildVolume: {x: 256, y: 256, z: 256}, averagePowerWatts: 130, maximumPowerWatts: 1000, purchasePrice: 42000, expectedLifetimeHours: 6000, maintenanceCostPerHour: 1, isMulticolor: true },
        { printerType: 'FDM', brand: 'Bambu Lab', model: 'P2S', buildVolume: {x: 256, y: 256, z: 256}, averagePowerWatts: 140, maximumPowerWatts: 1000, purchasePrice: 45000, expectedLifetimeHours: 6000, maintenanceCostPerHour: 1, isMulticolor: true },
        { printerType: 'FDM', brand: 'Bambu Lab', model: 'X1 Carbon', buildVolume: {x: 256, y: 256, z: 256}, averagePowerWatts: 140, maximumPowerWatts: 1000, purchasePrice: 70000, expectedLifetimeHours: 8000, maintenanceCostPerHour: 1, isMulticolor: true },
        { printerType: 'FDM', brand: 'Bambu Lab', model: 'H2D', buildVolume: {x: 350, y: 320, z: 325}, averagePowerWatts: 250, maximumPowerWatts: 1500, purchasePrice: 120000, expectedLifetimeHours: 10000, maintenanceCostPerHour: 2, isMulticolor: true },
        { printerType: 'FDM', brand: 'Creality', model: 'Ender-3 V3', buildVolume: {x: 220, y: 220, z: 250}, averagePowerWatts: 120, maximumPowerWatts: 350, purchasePrice: 12000, expectedLifetimeHours: 4000, maintenanceCostPerHour: 0.5, isMulticolor: false },
        { printerType: 'FDM', brand: 'Prusa', model: 'MK4', buildVolume: {x: 250, y: 210, z: 220}, averagePowerWatts: 100, maximumPowerWatts: 240, purchasePrice: 45000, expectedLifetimeHours: 10000, maintenanceCostPerHour: 0.5, isMulticolor: true },
        // SLA / MSLA
        { printerType: 'SLA', brand: 'Elegoo', model: 'Mars 4 Ultra', buildVolume: {x: 153, y: 77, z: 165}, averagePowerWatts: 45, maximumPowerWatts: 60, purchasePrice: 18000, expectedLifetimeHours: 3000, maintenanceCostPerHour: 1, isMulticolor: false },
        { printerType: 'SLA', brand: 'Anycubic', model: 'Photon Mono X2', buildVolume: {x: 196, y: 122, z: 200}, averagePowerWatts: 50, maximumPowerWatts: 75, purchasePrice: 22000, expectedLifetimeHours: 3000, maintenanceCostPerHour: 1, isMulticolor: false },
        { printerType: 'SLA', brand: 'Phrozen', model: 'Sonic Mini 8K', buildVolume: {x: 165, y: 72, z: 180}, averagePowerWatts: 60, maximumPowerWatts: 90, purchasePrice: 25000, expectedLifetimeHours: 3500, maintenanceCostPerHour: 1.5, isMulticolor: false },
    ];

    const defaultFilaments = [
        // FDM Filaments
        { materialType: 'FDM', materialName: 'PLA Basic', brand: 'Bambu Lab', density: 1.24, spoolWeight: 1000, pricePerSpool: 1200 },
        { materialType: 'FDM', materialName: 'PETG Basic', brand: 'Bambu Lab', density: 1.27, spoolWeight: 1000, pricePerSpool: 1100 },
        { materialType: 'FDM', materialName: 'ABS', brand: 'Generic', density: 1.04, spoolWeight: 1000, pricePerSpool: 850 },
        { materialType: 'FDM', materialName: 'TPU 95A', brand: 'Generic', density: 1.21, spoolWeight: 1000, pricePerSpool: 1500 },
        // SLA Resins (spoolWeight = bottle mL; density for volume→mass)
        { materialType: 'SLA', materialName: 'Standard Resin', brand: 'Elegoo', density: 1.10, spoolWeight: 500, pricePerSpool: 900 },
        { materialType: 'SLA', materialName: 'ABS-Like Resin', brand: 'Anycubic', density: 1.12, spoolWeight: 500, pricePerSpool: 1100 },
        { materialType: 'SLA', materialName: 'Water-Washable Resin', brand: 'Generic', density: 1.09, spoolWeight: 500, pricePerSpool: 850 },
    ];

    createApp({
        setup() {
            // State
            const isDarkMode = ref(false);
            const currentTab = ref('dashboard');
            const showChangelog = ref(false);
            const tabs = [
                { id: 'dashboard', name: 'Dashboard', icon: 'fa-solid fa-chart-pie' },
                { id: 'stl', name: 'File Analyzer', icon: 'fa-solid fa-cube' },
                { id: 'printers', name: 'Printers', icon: 'fa-solid fa-print' },
                { id: 'filaments', name: 'Filaments', icon: 'fa-solid fa-layer-group' },
                { id: 'calculator', name: 'Calculator Settings', icon: 'fa-solid fa-calculator' },
                { id: 'reports', name: 'Reports', icon: 'fa-solid fa-file-invoice' }
            ];

            const currentTabName = computed(() => tabs.find(t => t.id === currentTab.value)?.name || 'App');

            // Data lists
            const printers = ref([]);
            const filaments = ref([]);
            const activePrinter = ref(null);

            // Multi-filament: array of selected filament objects
            const activeFilaments = ref([]);

            // Backwards-compat computed (first selected)
            const activeFilament = computed(() => activeFilaments.value[0] || null);

            const activeFilamentsLabel = computed(() => {
                if (activeFilaments.value.length === 0) return 'Select Filament';
                if (activeFilaments.value.length === 1) return activeFilaments.value[0].materialName;
                return `${activeFilaments.value.length} Filaments`;
            });

            // Modals
            const showPrinterModal = ref(false);
            const showFilamentModal = ref(false);
            const editingPrinter = ref({});
            const editingFilament = ref({});

            // Material Filter
            const materialFilter = ref('All');
            const filteredMaterials = computed(() => {
                if (materialFilter.value === 'All') return filaments.value;
                return filaments.value.filter(f => f.materialType === materialFilter.value);
            });

            // Settings
            const savedSettingsStr = localStorage.getItem('3dcalc_settings');
            const savedSettings = savedSettingsStr ? JSON.parse(savedSettingsStr) : null;

            const settings = reactive({
                currency: savedSettings ? savedSettings.currency : 'PHP',
                electricityRate: savedSettings ? savedSettings.electricityRate : 12.50,
                laborRate: savedSettings ? savedSettings.laborRate : 100,
                setupTimeMinutes: savedSettings ? savedSettings.setupTimeMinutes : 10,
                postProcTimeMinutes: savedSettings ? savedSettings.postProcTimeMinutes : 15,
                wastePercentage: savedSettings ? savedSettings.wastePercentage : 10,
                fixedOverhead: savedSettings ? savedSettings.fixedOverhead : 30,
                pricingMethod: savedSettings ? savedSettings.pricingMethod : 'margin', // or markup
                profitMargin: savedSettings ? savedSettings.profitMargin : 30,
                minCharge: savedSettings ? savedSettings.minCharge : 150
            });

            // Watch for changes and save to localStorage
            watch(settings, (newVal) => {
                localStorage.setItem('3dcalc_settings', JSON.stringify(newVal));
            }, { deep: true });

            const allCurrencies = computed(() => {
                return [{"code": "AED", "label": "AED - United Arab Emirates Dirham"}, {"code": "AFN", "label": "AFN - Afghan Afghani"}, {"code": "ALL", "label": "ALL - Albanian Lek"}, {"code": "AMD", "label": "AMD - Armenian Dram"}, {"code": "ANG", "label": "ANG - Netherlands Antillean Guilder"}, {"code": "AOA", "label": "AOA - Angolan Kwanza"}, {"code": "ARS", "label": "ARS - Argentine Peso"}, {"code": "AUD", "label": "AUD - Australian Dollar"}, {"code": "AWG", "label": "AWG - Aruban Florin"}, {"code": "AZN", "label": "AZN - Azerbaijani Manat"}, {"code": "BAM", "label": "BAM - Bosnia-Herzegovina Convertible Mark"}, {"code": "BBD", "label": "BBD - Barbadian Dollar"}, {"code": "BDT", "label": "BDT - Bangladeshi Taka"}, {"code": "BGN", "label": "BGN - Bulgarian Lev"}, {"code": "BHD", "label": "BHD - Bahraini Dinar"}, {"code": "BIF", "label": "BIF - Burundian Franc"}, {"code": "BMD", "label": "BMD - Bermudan Dollar"}, {"code": "BND", "label": "BND - Brunei Dollar"}, {"code": "BOB", "label": "BOB - Bolivian Boliviano"}, {"code": "BRL", "label": "BRL - Brazilian Real"}, {"code": "BSD", "label": "BSD - Bahamian Dollar"}, {"code": "BTC", "label": "BTC - Bitcoin"}, {"code": "BTN", "label": "BTN - Bhutanese Ngultrum"}, {"code": "BWP", "label": "BWP - Botswanan Pula"}, {"code": "BYN", "label": "BYN - Belarusian Ruble"}, {"code": "BZD", "label": "BZD - Belize Dollar"}, {"code": "CAD", "label": "CAD - Canadian Dollar"}, {"code": "CDF", "label": "CDF - Congolese Franc"}, {"code": "CHF", "label": "CHF - Swiss Franc"}, {"code": "CLF", "label": "CLF - Chilean Unit of Account (UF)"}, {"code": "CLP", "label": "CLP - Chilean Peso"}, {"code": "CNH", "label": "CNH - Chinese Yuan (Offshore)"}, {"code": "CNY", "label": "CNY - Chinese Yuan"}, {"code": "COP", "label": "COP - Colombian Peso"}, {"code": "CRC", "label": "CRC - Costa Rican Col\u00f3n"}, {"code": "CUC", "label": "CUC - Cuban Convertible Peso"}, {"code": "CUP", "label": "CUP - Cuban Peso"}, {"code": "CVE", "label": "CVE - Cape Verdean Escudo"}, {"code": "CZK", "label": "CZK - Czech Republic Koruna"}, {"code": "DJF", "label": "DJF - Djiboutian Franc"}, {"code": "DKK", "label": "DKK - Danish Krone"}, {"code": "DOP", "label": "DOP - Dominican Peso"}, {"code": "DZD", "label": "DZD - Algerian Dinar"}, {"code": "EGP", "label": "EGP - Egyptian Pound"}, {"code": "ERN", "label": "ERN - Eritrean Nakfa"}, {"code": "ETB", "label": "ETB - Ethiopian Birr"}, {"code": "EUR", "label": "EUR - Euro"}, {"code": "FJD", "label": "FJD - Fijian Dollar"}, {"code": "FKP", "label": "FKP - Falkland Islands Pound"}, {"code": "GBP", "label": "GBP - British Pound Sterling"}, {"code": "GEL", "label": "GEL - Georgian Lari"}, {"code": "GGP", "label": "GGP - Guernsey Pound"}, {"code": "GHS", "label": "GHS - Ghanaian Cedi"}, {"code": "GIP", "label": "GIP - Gibraltar Pound"}, {"code": "GMD", "label": "GMD - Gambian Dalasi"}, {"code": "GNF", "label": "GNF - Guinean Franc"}, {"code": "GTQ", "label": "GTQ - Guatemalan Quetzal"}, {"code": "GYD", "label": "GYD - Guyanaese Dollar"}, {"code": "HKD", "label": "HKD - Hong Kong Dollar"}, {"code": "HNL", "label": "HNL - Honduran Lempira"}, {"code": "HRK", "label": "HRK - Croatian Kuna"}, {"code": "HTG", "label": "HTG - Haitian Gourde"}, {"code": "HUF", "label": "HUF - Hungarian Forint"}, {"code": "IDR", "label": "IDR - Indonesian Rupiah"}, {"code": "ILS", "label": "ILS - Israeli New Sheqel"}, {"code": "IMP", "label": "IMP - Manx pound"}, {"code": "INR", "label": "INR - Indian Rupee"}, {"code": "IQD", "label": "IQD - Iraqi Dinar"}, {"code": "IRR", "label": "IRR - Iranian Rial"}, {"code": "ISK", "label": "ISK - Icelandic Kr\u00f3na"}, {"code": "JEP", "label": "JEP - Jersey Pound"}, {"code": "JMD", "label": "JMD - Jamaican Dollar"}, {"code": "JOD", "label": "JOD - Jordanian Dinar"}, {"code": "JPY", "label": "JPY - Japanese Yen"}, {"code": "KES", "label": "KES - Kenyan Shilling"}, {"code": "KGS", "label": "KGS - Kyrgystani Som"}, {"code": "KHR", "label": "KHR - Cambodian Riel"}, {"code": "KMF", "label": "KMF - Comorian Franc"}, {"code": "KPW", "label": "KPW - North Korean Won"}, {"code": "KRW", "label": "KRW - South Korean Won"}, {"code": "KWD", "label": "KWD - Kuwaiti Dinar"}, {"code": "KYD", "label": "KYD - Cayman Islands Dollar"}, {"code": "KZT", "label": "KZT - Kazakhstani Tenge"}, {"code": "LAK", "label": "LAK - Laotian Kip"}, {"code": "LBP", "label": "LBP - Lebanese Pound"}, {"code": "LKR", "label": "LKR - Sri Lankan Rupee"}, {"code": "LRD", "label": "LRD - Liberian Dollar"}, {"code": "LSL", "label": "LSL - Lesotho Loti"}, {"code": "LYD", "label": "LYD - Libyan Dinar"}, {"code": "MAD", "label": "MAD - Moroccan Dirham"}, {"code": "MDL", "label": "MDL - Moldovan Leu"}, {"code": "MGA", "label": "MGA - Malagasy Ariary"}, {"code": "MKD", "label": "MKD - Macedonian Denar"}, {"code": "MMK", "label": "MMK - Myanma Kyat"}, {"code": "MNT", "label": "MNT - Mongolian Tugrik"}, {"code": "MOP", "label": "MOP - Macanese Pataca"}, {"code": "MRU", "label": "MRU - Mauritanian Ouguiya"}, {"code": "MUR", "label": "MUR - Mauritian Rupee"}, {"code": "MVR", "label": "MVR - Maldivian Rufiyaa"}, {"code": "MWK", "label": "MWK - Malawian Kwacha"}, {"code": "MXN", "label": "MXN - Mexican Peso"}, {"code": "MYR", "label": "MYR - Malaysian Ringgit"}, {"code": "MZN", "label": "MZN - Mozambican Metical"}, {"code": "NAD", "label": "NAD - Namibian Dollar"}, {"code": "NGN", "label": "NGN - Nigerian Naira"}, {"code": "NIO", "label": "NIO - Nicaraguan C\u00f3rdoba"}, {"code": "NOK", "label": "NOK - Norwegian Krone"}, {"code": "NPR", "label": "NPR - Nepalese Rupee"}, {"code": "NZD", "label": "NZD - New Zealand Dollar"}, {"code": "OMR", "label": "OMR - Omani Rial"}, {"code": "PAB", "label": "PAB - Panamanian Balboa"}, {"code": "PEN", "label": "PEN - Peruvian Nuevo Sol"}, {"code": "PGK", "label": "PGK - Papua New Guinean Kina"}, {"code": "PHP", "label": "PHP - Philippine Peso"}, {"code": "PKR", "label": "PKR - Pakistani Rupee"}, {"code": "PLN", "label": "PLN - Polish Zloty"}, {"code": "PYG", "label": "PYG - Paraguayan Guarani"}, {"code": "QAR", "label": "QAR - Qatari Rial"}, {"code": "RON", "label": "RON - Romanian Leu"}, {"code": "RSD", "label": "RSD - Serbian Dinar"}, {"code": "RUB", "label": "RUB - Russian Ruble"}, {"code": "RWF", "label": "RWF - Rwandan Franc"}, {"code": "SAR", "label": "SAR - Saudi Riyal"}, {"code": "SBD", "label": "SBD - Solomon Islands Dollar"}, {"code": "SCR", "label": "SCR - Seychellois Rupee"}, {"code": "SDG", "label": "SDG - Sudanese Pound"}, {"code": "SEK", "label": "SEK - Swedish Krona"}, {"code": "SGD", "label": "SGD - Singapore Dollar"}, {"code": "SHP", "label": "SHP - Saint Helena Pound"}, {"code": "SLE", "label": "SLE - Sierra Leonean Leone"}, {"code": "SLL", "label": "SLL - Sierra Leonean Leone (Old)"}, {"code": "SOS", "label": "SOS - Somali Shilling"}, {"code": "SRD", "label": "SRD - Surinamese Dollar"}, {"code": "SSP", "label": "SSP - South Sudanese Pound"}, {"code": "STD", "label": "STD - S\u00e3o Tom\u00e9 and Pr\u00edncipe Dobra (pre-2018)"}, {"code": "STN", "label": "STN - S\u00e3o Tom\u00e9 and Pr\u00edncipe Dobra"}, {"code": "SVC", "label": "SVC - Salvadoran Col\u00f3n"}, {"code": "SYP", "label": "SYP - Syrian Pound"}, {"code": "SZL", "label": "SZL - Swazi Lilangeni"}, {"code": "THB", "label": "THB - Thai Baht"}, {"code": "TJS", "label": "TJS - Tajikistani Somoni"}, {"code": "TMT", "label": "TMT - Turkmenistani Manat"}, {"code": "TND", "label": "TND - Tunisian Dinar"}, {"code": "TOP", "label": "TOP - Tongan Pa'anga"}, {"code": "TRY", "label": "TRY - Turkish Lira"}, {"code": "TTD", "label": "TTD - Trinidad and Tobago Dollar"}, {"code": "TWD", "label": "TWD - New Taiwan Dollar"}, {"code": "TZS", "label": "TZS - Tanzanian Shilling"}, {"code": "UAH", "label": "UAH - Ukrainian Hryvnia"}, {"code": "UGX", "label": "UGX - Ugandan Shilling"}, {"code": "USD", "label": "USD - United States Dollar"}, {"code": "UYU", "label": "UYU - Uruguayan Peso"}, {"code": "UZS", "label": "UZS - Uzbekistan Som"}, {"code": "VEF", "label": "VEF - Venezuelan Bol\u00edvar Fuerte (Old)"}, {"code": "VES", "label": "VES - Venezuelan Bol\u00edvar Soberano"}, {"code": "VND", "label": "VND - Vietnamese Dong"}, {"code": "VUV", "label": "VUV - Vanuatu Vatu"}, {"code": "WST", "label": "WST - Samoan Tala"}, {"code": "XAF", "label": "XAF - CFA Franc BEAC"}, {"code": "XAG", "label": "XAG - Silver Ounce"}, {"code": "XAU", "label": "XAU - Gold Ounce"}, {"code": "XCD", "label": "XCD - East Caribbean Dollar"}, {"code": "XCG", "label": "XCG - Caribbean Guilder"}, {"code": "XDR", "label": "XDR - Special Drawing Rights"}, {"code": "XOF", "label": "XOF - CFA Franc BCEAO"}, {"code": "XPD", "label": "XPD - Palladium Ounce"}, {"code": "XPF", "label": "XPF - CFP Franc"}, {"code": "XPT", "label": "XPT - Platinum Ounce"}, {"code": "YER", "label": "YER - Yemeni Rial"}, {"code": "ZAR", "label": "ZAR - South African Rand"}, {"code": "ZMW", "label": "ZMW - Zambian Kwacha"}, {"code": "ZWG", "label": "ZWG - Zimbabwean ZiG"}, {"code": "ZWL", "label": "ZWL - Zimbabwean Dollar"}];
            });

            // File state (STL + 3MF)
            const modelFile = ref(null);
            const fileType = ref(''); // 'stl' or '3mf'
            const isProcessingSTL = ref(false);
            const processingMessage = ref('Analyzing Geometry...');
            const stlData = reactive({
                dimX: 0, dimY: 0, dimZ: 0,
                volume: 0, surfaceArea: 0,
                triangles: 0
            });
            const threeMFColors = ref([]); // extracted color channels from 3MF
            let scene, camera, renderer, controls, mesh;

            // Filament helpers
            const isFilamentActive = (id) => activeFilaments.value.some(f => f.id === id);
            const activeFilamentIndex = (id) => activeFilaments.value.findIndex(f => f.id === id);
            const filamentColor = (idx) => (idx >= 0 && idx < SWATCH_PALETTE.length) ? SWATCH_PALETTE[idx] : '#94a3b8';

            const toggleFilamentSelection = (filament) => {
                const idx = activeFilaments.value.findIndex(f => f.id === filament.id);
                if (idx >= 0) activeFilaments.value.splice(idx, 1);
                else activeFilaments.value.push(filament);
            };
            const removeActiveFilament = (id) => {
                const idx = activeFilaments.value.findIndex(f => f.id === id);
                if (idx >= 0) activeFilaments.value.splice(idx, 1);
            };
            const clearActiveFilaments = () => { activeFilaments.value = []; };

            // Estimation settings
            const printSettings = reactive({
                infill: 15,
                layerHeight: 0.2,
                walls: 2,
                supports: false
            });

            const actualData = reactive({
                weight: null,
                timeHours: null
            });

            // --- Calculation Engine ---
            const breakdownItems = computed(() => {
                // 1. Material Calculation — average cost across all selected filaments/resins
                let materialUnits = 0; // grams for FDM, mL for SLA
                let materialCost = 0;
                
                const isSLA = activePrinter.value?.printerType === 'SLA';

                const avgDensity = activeFilaments.value.length > 0
                    ? activeFilaments.value.reduce((s, f) => s + f.density, 0) / activeFilaments.value.length
                    : 0;
                const avgCostPerUnit = activeFilaments.value.length > 0
                    ? activeFilaments.value.reduce((s, f) => s + (f.pricePerSpool / f.spoolWeight), 0) / activeFilaments.value.length
                    : 0;

                if (actualData.weight) {
                    // Manual override in grams
                    if (isSLA && avgDensity > 0) {
                        materialUnits = actualData.weight / avgDensity; // convert g to mL
                    } else {
                        materialUnits = actualData.weight;
                    }
                } else if (stlData.volume > 0) {
                    let volumeCm3 = stlData.volume / 1000; // cm³ is same as mL
                    
                    if (isSLA) {
                        // SLA typically prints solid (unless hollowed), apply support factor
                        let supportFactor = printSettings.supports ? 1.20 : 1.0;
                        materialUnits = volumeCm3 * supportFactor;
                    } else {
                        // FDM
                        if (avgDensity > 0) {
                            let solidFactor = 0.2 + (printSettings.infill / 100) * 0.8;
                            let supportFactor = printSettings.supports ? 1.15 : 1.0;
                            let adjustedVolume = volumeCm3 * solidFactor * supportFactor;
                            materialUnits = adjustedVolume * avgDensity;
                        }
                    }
                }

                if (activeFilaments.value.length > 0) {
                    materialCost = materialUnits * avgCostPerUnit;
                }

                // 2. Print Time Estimation
                let printTimeH = 0;
                if (actualData.timeHours) {
                    printTimeH = actualData.timeHours;
                } else if (materialUnits > 0) {
                    if (isSLA) {
                        // Very rough SLA estimate based on Z-height, assuming ~20mm/hour
                        printTimeH = stlData.dimZ > 0 ? (stlData.dimZ / 20) : (materialUnits / 20);
                    } else {
                        let speedFactor = (activePrinter.value && activePrinter.value.brand === 'Bambu Lab') ? 20 : 10;
                        printTimeH = materialUnits / speedFactor;
                    }
                }

                // 3. Electricity
                let electricityCost = 0;
                if (activePrinter.value && printTimeH > 0) {
                    let kwh = (activePrinter.value.averagePowerWatts * printTimeH) / 1000;
                    electricityCost = kwh * settings.electricityRate;
                }

                // 4. Machine Cost (Depreciation)
                let machineCost = 0;
                if (activePrinter.value && printTimeH > 0 && activePrinter.value.expectedLifetimeHours) {
                    machineCost = (activePrinter.value.purchasePrice / activePrinter.value.expectedLifetimeHours) * printTimeH;
                }

                // 5. Labor
                let laborHours = (settings.setupTimeMinutes + settings.postProcTimeMinutes) / 60;
                let laborCost = laborHours * settings.laborRate;

                // 6. Waste
                let wasteCost = (materialCost + electricityCost) * (settings.wastePercentage / 100);

                // 7. Overhead
                let overheadCost = settings.fixedOverhead;

                return {
                    filament: { label: isSLA ? 'Resin Material' : 'Filament Material', icon: isSLA ? 'fa-solid fa-droplet' : 'fa-solid fa-layer-group', value: materialCost, mass: materialUnits },
                    electricity: { label: 'Electricity', icon: 'fa-solid fa-bolt', value: electricityCost, time: printTimeH },
                    machine: { label: 'Machine Depreciation', icon: 'fa-solid fa-microchip', value: machineCost },
                    labor: { label: 'Labor (Setup & Post)', icon: 'fa-solid fa-user-clock', value: laborCost },
                    waste: { label: 'Waste Allowance (' + settings.wastePercentage + '%)', icon: 'fa-solid fa-recycle', value: wasteCost },
                    overhead: { label: 'Overhead', icon: 'fa-solid fa-building', value: overheadCost }
                };
            });

            const results = computed(() => {
                const b = breakdownItems.value;
                const totalCost = b.filament.value + b.electricity.value + b.machine.value + b.labor.value + b.waste.value + b.overhead.value;
                
                let sellingPrice = 0;
                if (settings.pricingMethod === 'margin') {
                    // Price = Cost / (1 - margin)
                    let marginDec = Math.min(settings.profitMargin / 100, 0.99); // cap at 99%
                    sellingPrice = totalCost / (1 - marginDec);
                } else {
                    // Price = Cost * (1 + markup)
                    sellingPrice = totalCost * (1 + (settings.profitMargin / 100));
                }

                // Apply minimum charge
                if (sellingPrice < settings.minCharge) {
                    sellingPrice = settings.minCharge;
                }

                let profitAmount = sellingPrice - totalCost;

                return {
                    totalCost: totalCost || 0,
                    sellingPrice: sellingPrice || 0,
                    profitAmount: profitAmount || 0,
                    printTimeHours: b.electricity.time || 0
                };
            });

            // Utils
            const formatCurrency = (val, decimals = 2) => {
                try {
                    return new Intl.NumberFormat(undefined, {
                        style: 'currency',
                        currency: settings.currency,
                        minimumFractionDigits: decimals,
                        maximumFractionDigits: decimals
                    }).format(val);
                } catch (e) {
                    return settings.currency + ' ' + Number(val).toLocaleString(undefined, {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
                }
            };
            const formatTime = (hours) => {
                if(!hours) return '0h 0m';
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);
                return `${h}h ${m}m`;
            };

            const toggleDarkMode = () => {
                isDarkMode.value = !isDarkMode.value;
                document.documentElement.classList.toggle('dark', isDarkMode.value);
                if (renderer) renderer.setClearColor(isDarkMode.value ? 0x1e293b : 0xe2e8f0);
            };

            // Database Operations
            const loadData = async () => {
                if ((await db.printers.count()) === 0) {
                    await db.printers.bulkAdd(defaultPrinters);
                }
                if ((await db.filaments.count()) === 0) {
                    await db.filaments.bulkAdd(defaultFilaments);
                }

                printers.value = await db.printers.toArray();
                filaments.value = await db.filaments.toArray();
                
                if(printers.value.length > 0) activePrinter.value = printers.value[0];
                if(filaments.value.length > 0 && activeFilaments.value.length === 0) {
                    activeFilaments.value = [filaments.value[0]];
                }
            };

            // Printer Handlers
            const openPrinterModal = (printer = null) => {
                editingPrinter.value = printer ? {...printer} : { printerType: 'FDM', brand: '', model: '', buildVolume: {x: 200, y: 200, z: 200}, averagePowerWatts: 100, maximumPowerWatts: 300, purchasePrice: 0, expectedLifetimeHours: 5000, isMulticolor: false };
                showPrinterModal.value = true;
            };
            const savePrinter = async () => {
                const rawPrinter = JSON.parse(JSON.stringify(editingPrinter.value));
                if(rawPrinter.id) await db.printers.put(rawPrinter);
                else await db.printers.add(rawPrinter);
                showPrinterModal.value = false;
                loadData();
            };
            const deletePrinter = async (id) => {
                if(confirm("Delete this printer?")) {
                    await db.printers.delete(id);
                    if(activePrinter.value?.id === id) activePrinter.value = null;
                    loadData();
                }
            };
            const selectPrinter = (p) => activePrinter.value = p;

            // Filament Handlers
            const openFilamentModal = (filament = null) => {
                editingFilament.value = filament ? {...filament} : { materialType: 'FDM', materialName: '', brand: '', density: 1.24, spoolWeight: 1000, pricePerSpool: 1000 };
                showFilamentModal.value = true;
            };
            const saveFilament = async () => {
                const rawFilament = JSON.parse(JSON.stringify(editingFilament.value));
                if(rawFilament.id) await db.filaments.put(rawFilament);
                else await db.filaments.add(rawFilament);
                showFilamentModal.value = false;
                loadData();
            };
            const deleteFilament = async (id) => {
                if(confirm("Delete this filament?")) {
                    await db.filaments.delete(id);
                    removeActiveFilament(id);
                    loadData();
                }
            };

            // Three.js Viewer Setup
            const initThreeJS = () => {
                const container = document.getElementById('stl-viewer');
                scene = new THREE.Scene();
                const aspect = (container.clientWidth / container.clientHeight) || 1;
                camera = new THREE.PerspectiveCamera(45, aspect, 1, 10000);
                camera.position.set(200, 200, 200);

                renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                renderer.setSize(container.clientWidth, container.clientHeight);
                renderer.setClearColor(isDarkMode.value ? 0x1e293b : 0xe2e8f0);
                container.appendChild(renderer.domElement);

                controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;

                const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
                hemiLight.position.set( 0, 200, 0 );
                scene.add( hemiLight );
                const dirLight = new THREE.DirectionalLight( 0xffffff );
                dirLight.position.set( 0, 200, 100 );
                scene.add( dirLight );

                const grid = new THREE.GridHelper(200, 20, 0x000000, 0x000000);
                grid.material.opacity = 0.2;
                grid.material.transparent = true;
                scene.add(grid);

                const animate = function () {
                    requestAnimationFrame(animate);
                    controls.update();
                    renderer.render(scene, camera);
                };
                animate();

                window.addEventListener('resize', () => {
                    if(container && container.clientWidth > 0) {
                        camera.aspect = container.clientWidth / container.clientHeight;
                        camera.updateProjectionMatrix();
                        renderer.setSize(container.clientWidth, container.clientHeight);
                    }
                });
            };

            const toggleWireframe = () => {
                if (mesh) mesh.material.wireframe = !mesh.material.wireframe;
            };
            const resetCamera = () => {
                camera.position.set(200, 200, 200);
                controls.target.set(0,0,0);
                controls.update();
            };

            // ── Geometry helpers ───────────────────────────────────────────────
            const analyzeGeometry = (geometry) => {
                geometry.computeBoundingBox();
                const box = geometry.boundingBox;
                stlData.dimX = box.max.x - box.min.x;
                stlData.dimY = box.max.y - box.min.y;
                stlData.dimZ = box.max.z - box.min.z;
                stlData.triangles = geometry.attributes.position.count / 3;

                let vol = 0;
                let p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
                const pos = geometry.attributes.position;
                for (let i = 0; i < pos.count; i += 3) {
                    p1.fromBufferAttribute(pos, i);
                    p2.fromBufferAttribute(pos, i+1);
                    p3.fromBufferAttribute(pos, i+2);
                    vol += p1.dot(p2.cross(p3)) / 6.0;
                }
                stlData.volume = Math.abs(vol);

                let area = 0;
                let ab = new THREE.Vector3(), ac = new THREE.Vector3();
                for (let i = 0; i < pos.count; i += 3) {
                    p1.fromBufferAttribute(pos, i);
                    p2.fromBufferAttribute(pos, i+1);
                    p3.fromBufferAttribute(pos, i+2);
                    ab.subVectors(p2, p1);
                    ac.subVectors(p3, p1);
                    area += ab.cross(ac).length() / 2.0;
                }
                stlData.surfaceArea = area;
            };

            const displayGeometry = (geometry, color = 0x3b82f6) => {
                if (mesh) scene.remove(mesh);
                const material = new THREE.MeshPhongMaterial({ color, specular: 0x111111, shininess: 200 });
                mesh = new THREE.Mesh(geometry, material);
                geometry.center();
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.y = stlData.dimZ / 2;
                scene.add(mesh);
                resetCamera();
            };

            // ── 3MF Parser ─────────────────────────────────────────────────────
            /**
             * 3MF is a ZIP archive containing 3D/3dmodel.model (XML with mesh data).
             * We use JSZip to unzip + DOMParser to read the XML.
             */
            const parse3MF = async (arrayBuffer) => {
                const zip = await JSZip.loadAsync(arrayBuffer);

                let modelEntry = null;
                zip.forEach((relativePath, file) => {
                    if (!modelEntry && relativePath.toLowerCase().endsWith('.model')) {
                        modelEntry = file;
                    }
                });

                if (!modelEntry) throw new Error('No .model file found inside 3MF archive');

                const rawXmlText = await modelEntry.async('text');
                const xmlText = rawXmlText.replace(/xmlns(:\w+)?=".*?"/g, '');
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

                // Extract color channels
                const colors = [];
                const colorGroupEls = xmlDoc.querySelectorAll('colorgroup color, basematerials base');
                colorGroupEls.forEach(el => {
                    const c = el.getAttribute('color') || el.getAttribute('displaycolor');
                    if (c) colors.push(c);
                });
                if (colors.length === 0) {
                    const anyColorEls = xmlDoc.querySelectorAll('[displaycolor],[color]');
                    anyColorEls.forEach(el => {
                        const c = el.getAttribute('displaycolor') || el.getAttribute('color');
                        if (c && !colors.includes(c)) colors.push(c);
                    });
                }
                threeMFColors.value = colors;

                // Extract all meshes and merge into one geometry
                const meshEls = xmlDoc.querySelectorAll('mesh');
                if (meshEls.length === 0) throw new Error('No mesh data found in 3MF file');

                let allPositions = [];
                meshEls.forEach(meshEl => {
                    const vertexEls = meshEl.querySelectorAll('vertices vertex');
                    const triangleEls = meshEl.querySelectorAll('triangles triangle');
                    const verts = [];
                    vertexEls.forEach(v => {
                        verts.push(
                            parseFloat(v.getAttribute('x') || 0),
                            parseFloat(v.getAttribute('y') || 0),
                            parseFloat(v.getAttribute('z') || 0)
                        );
                    });
                    triangleEls.forEach(t => {
                        const v1 = parseInt(t.getAttribute('v1'));
                        const v2 = parseInt(t.getAttribute('v2'));
                        const v3 = parseInt(t.getAttribute('v3'));
                        allPositions.push(
                            verts[v1*3], verts[v1*3+1], verts[v1*3+2],
                            verts[v2*3], verts[v2*3+1], verts[v2*3+2],
                            verts[v3*3], verts[v3*3+1], verts[v3*3+2]
                        );
                    });
                });

                if (allPositions.length === 0) throw new Error('3MF mesh has no geometry data');

                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPositions, 3));
                geometry.computeVertexNormals();
                return geometry;
            };

            // ── G-Code Parser (OrcaSlicer/PrusaSlicer) ─────────────────────────
            const parseGcode = (text) => {
                let weight = 0;
                let timeHours = 0;

                // Match filament used [g] = 15.23
                const weightMatch = text.match(/;\s*filament used \[g\]\s*=\s*([0-9.]+)/i);
                if (weightMatch && weightMatch[1]) {
                    weight = parseFloat(weightMatch[1]);
                }

                // Match estimated printing time (normal mode) = 1h 23m 45s
                const timeMatch = text.match(/;\s*estimated printing time[^=]*=\s*(.+)/i);
                if (timeMatch && timeMatch[1]) {
                    const timeStr = timeMatch[1].trim();
                    let hours = 0, mins = 0, secs = 0;
                    
                    const hMatch = timeStr.match(/(\d+)h/i);
                    const mMatch = timeStr.match(/(\d+)m/i);
                    const sMatch = timeStr.match(/(\d+)s/i);

                    if (hMatch) hours = parseInt(hMatch[1]);
                    if (mMatch) mins = parseInt(mMatch[1]);
                    if (sMatch) secs = parseInt(sMatch[1]);
                    
                    timeHours = hours + (mins / 60) + (secs / 3600);
                }

                return { weight, timeHours };
            };

            // ── File Upload Handler (STL, 3MF, GCODE) ──────────────────────────
            const handleFileUpload = (event) => {
                const file = event.target.files[0];
                if (!file) return;

                modelFile.value = file;
                isProcessingSTL.value = true;
                actualData.weight = null;
                actualData.timeHours = null;
                threeMFColors.value = [];

                const ext = file.name.split('.').pop().toLowerCase();
                fileType.value = ext;

                const reader = new FileReader();
                reader.addEventListener('load', async function (ev) {
                    const contents = ev.target.result;
                    try {
                        if (ext === 'stl') {
                            processingMessage.value = 'Analyzing STL Geometry...';
                            const loader = new THREE.STLLoader();
                            const geometry = loader.parse(contents);
                            analyzeGeometry(geometry);
                            displayGeometry(geometry, 0x3b82f6);
                        } else if (ext === '3mf') {
                            processingMessage.value = 'Parsing 3MF Archive...';
                            const geometry = await parse3MF(contents);
                            analyzeGeometry(geometry);
                            displayGeometry(geometry, 0x7c3aed);
                        } else if (ext === 'gcode') {
                            processingMessage.value = 'Extracting OrcaSlicer Data...';
                            const gcodeData = parseGcode(contents);
                            if (gcodeData.weight > 0) actualData.weight = parseFloat(gcodeData.weight.toFixed(2));
                            if (gcodeData.timeHours > 0) actualData.timeHours = parseFloat(gcodeData.timeHours.toFixed(2));
                            
                            // Clear 3D canvas (keep grid/lights)
                            if (scene) {
                                scene.children = scene.children.filter(c => c.type === 'AmbientLight' || c.type === 'DirectionalLight' || c.type === 'GridHelper' || c.type === 'AxesHelper');
                                renderer.render(scene, camera);
                            }
                        } else {
                            throw new Error('Unsupported file type: ' + ext);
                        }
                    } catch (e) {
                        alert('Error parsing file: ' + e.message + '\n\nMake sure it is a valid STL, 3MF, or GCODE file.');
                        console.error(e);
                    }
                    isProcessingSTL.value = false;
                }, false);

                if (ext === 'gcode') {
                    reader.readAsText(file);
                } else {
                    reader.readAsArrayBuffer(file);
                }
                event.target.value = ''; // allow re-upload of same file
            };

            // PDF Generation
            const generatePDF = () => {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                doc.setFont("helvetica", "bold");
                doc.setFontSize(22);
                doc.text("3D Printing Quotation", 20, 20);
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text("Date: " + new Date().toLocaleDateString(), 20, 30);
                doc.text("Generated by 3D Calc Pro " + APP_VERSION, 20, 37);
                
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text("Project Details", 20, 52);
                
                doc.setFont("helvetica", "normal");
                const filamentLabel = activeFilaments.value.length > 0
                    ? activeFilaments.value.map(f => f.brand + ' ' + f.materialName).join(', ')
                    : 'N/A';

                doc.text(`File: ${modelFile.value ? modelFile.value.name : 'N/A'} (${fileType.value.toUpperCase() || 'N/A'})`, 20, 62);
                doc.text(`Printer: ${activePrinter.value ? activePrinter.value.brand + ' ' + activePrinter.value.model : 'N/A'}`, 20, 69);
                doc.text(`Material(s): ${filamentLabel}`, 20, 76);
                doc.text(`Est. Print Time: ${formatTime(results.value.printTimeHours)}`, 20, 83);
                if (fileType.value === '3mf' && threeMFColors.value.length > 0) {
                    doc.text(`Filament Channels: ${threeMFColors.value.length}`, 20, 90);
                }

                doc.setFont("helvetica", "bold");
                doc.text("Cost Breakdown", 20, 105);
                
                doc.setFont("helvetica", "normal");
                let y = 115;
                const b = breakdownItems.value;
                const lines = [
                    [b.filament.label, formatCurrency(b.filament.value)],
                    ["Electricity & Operation", formatCurrency(b.electricity.value + b.machine.value)],
                    ["Labor & Setup", formatCurrency(b.labor.value)],
                    ["Overhead & Allowances", formatCurrency(b.waste.value + b.overhead.value)],
                ];
                
                lines.forEach(l => {
                    doc.text(l[0], 20, y);
                    doc.text(l[1], 150, y, {align: 'right'});
                    y += 10;
                });
                
                doc.line(20, y-5, 150, y-5);
                doc.setFont("helvetica", "bold");
                doc.text("Subtotal Cost", 20, y+5);
                doc.text(formatCurrency(results.value.totalCost), 150, y+5, {align: 'right'});

                y += 25;
                doc.setFillColor(240, 240, 240);
                doc.rect(20, y-10, 140, 25, 'F');
                doc.setFontSize(14);
                doc.text("Recommended Selling Price:", 25, y+5);
                doc.setFontSize(18);
                doc.text(formatCurrency(results.value.sellingPrice), 150, y+5, {align: 'right'});
                
                doc.save("3D_Print_Quotation.pdf");
            };

            onMounted(() => {
                loadData();
                initThreeJS();
            });

            watch(currentTab, (newTab) => {
                if(newTab === 'stl') {
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                    }, 50);
                }
            });

            return {
                APP_VERSION, changelog: CHANGELOG,
                isDarkMode, toggleDarkMode,
                showChangelog,
                currentTab, tabs, currentTabName,
                settings, printers, filaments,
                activePrinter, activeFilament, activeFilaments,
                materialFilter, filteredMaterials,
                activeFilamentsLabel, selectPrinter,
                isFilamentActive, activeFilamentIndex, filamentColor,
                toggleFilamentSelection, removeActiveFilament, clearActiveFilaments,
                showPrinterModal, editingPrinter, openPrinterModal, savePrinter, deletePrinter,
                showFilamentModal, editingFilament, openFilamentModal, saveFilament, deleteFilament,
                modelFile, fileType, isProcessingSTL, processingMessage,
                stlData, threeMFColors, handleFileUpload,
                resetCamera, toggleWireframe, printSettings, actualData,
                breakdownItems, results, formatCurrency, formatTime, generatePDF
            };
        }
    }).mount('#app');
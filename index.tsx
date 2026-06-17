// ============================================
// SISTEMA DE ALMACENAMIENTO PERSISTENTE
// ============================================
import { GoogleGenAI } from "@google/genai";
import { GAMES, GameConfig } from "./game-configs";

// FIX: Added interfaces for strong typing of complex objects.
interface Draw {
  id: number;
  date: Date;
  numbers: number[];
  stars?: number[]; // Added for Euromillones
  complementario?: number; // Added for 6/49
  reintegro?: number; // Added for 6/49
  sum: number;
}

interface Ticket {
  date: string; // Creation date
  combinations: number[][];
  stars?: number[][]; // Optional stars for Euromillones
  strategy: string;
  gameId: string; // NEW: To identify the game this ticket belongs to
  drawDate?: string; // Optional draw date for the ticket
  validation?: { // Optional validation results
    winningNumbers: number[];
    stars?: number[];
    hits: number[];
    starHits?: number[];
  };
}

interface Filters {
  terminaciones: number[];
  terminacionesDistintas: number[];
  sum: { min: number; max: number };
  parImpar: string[];
  bajosAltos: string[];
  primos: { min: number; max: number };
  consecutivos: string[];
  distancia: { min: number; max: number };
  agrupDecenas: string[];
  sumaDigitos: { min: number; max: number };
  desviacion: { min: number; max: number };
  entropyTerminaciones: { min: number; max: number };
  entropyIntervalos: { min: number; max: number };
  geometric: { exclude: string[]; favor: string[] };
  // Star filters
  starSum: { min: number; max: number };
  starParImpar: string[];
  starBajosAltos: string[];
  starSumaDigitos: { min: number; max: number };
  starPrimos: { min: number; max: number };
  starConsecutivos: string[];
  starDistancia: { min: number; max: number };
  useMarkov: boolean;
  useNash: boolean;
  useRegression: boolean;
  ai: {
    markovDepth: number;
    nashWeight: number;
    regressionBonus: number;
  }
}

interface FilterPreset {
  id: string;
  name: string;
  date: string;
  filters: Filters;
}

// Clase principal de la aplicación
class DataLotto49Advanced {
  getNumberCoords(n: number) {
      const cols = this.currentGame.gridCols;
      return { row: Math.floor((n - 1) / cols), col: (n - 1) % cols };
  }
  
  static APP_STATE_KEY = 'dataLotto49State';
  static FILTER_PRESET_KEY = 'dataLotto49Filters';


    // FIX: Declared all class properties with their correct types to resolve property-does-not-exist errors.
    selectedNumbers: Set<number>;
    selectedStars: Set<number>; // New for Euromillones
    suggestedNumbers: Set<number>; // New for Big Data
    suggestedStars: Set<number>; // New for Euromillones Big Data
    excludedNumbers: Set<number>;
    excludedStars: Set<number>; // New for Euromillones
    hotNumbers: Set<number>;
    hotStars: Set<number>; // New for Euromillones
    coldNumbers: Set<number>;
    coldStars: Set<number>; // New for Euromillones
    absentNumbers: Set<number>;
    absentStars: Set<number>; // New for Euromillones
    favoriteNumbers: Set<number>; // New for Favorites
    favoriteStars: Set<number>; // New for Euromillones Favorites
    favoriteGames: Set<string>; // New for Game Database Favorites
    customGameUrls: { [key: string]: string }; // New for custom URLs
    filterPresets: FilterPreset[]; // New for named filter presets
    gameFilters: { [gameId: string]: Filters }; // NEW: Independent filters per game
    currentSelectionMode: 'excluded' | 'hot' | 'cold' | 'figure' | 'absent' | 'favorites' | null;
    isGenerating: boolean;
    activeDashboardFilters: Set<string>;
    lastMultipleStats: { validCount: number, totalCount: number } | null;
    lastDebugInfo: string;
    savedTickets: Ticket[];
    currentTicket: Ticket | null;
    currentValidatingTicket: Ticket | null;
    historicalData: Draw[];
    numberStats: { [key: number]: { frequency: number; score: number; lastSeen: number; } };
    starStats: { [key: number]: { frequency: number; score: number; lastSeen: number; } }; // New for Euromillones
    analysisPeriod: number;
    dataLoaded: boolean;
    dataType: string;
    filters: Filters;
    primes: Set<number>;
    TOLERANCE_LEVELS: { [key: number]: number };
    currentGame: GameConfig;

    // New AI & Correlation UI elements
    aiPredictBtn: HTMLElement | null = null;
    correlationScoreContainer: HTMLElement | null = null;
    correlationScoreValue: HTMLElement | null = null;
    correlationScoreBar: HTMLElement | null = null;
    correlationAdvice: HTMLElement | null = null;


    // New Trend UI elements
    drawTrendPanel: HTMLElement | null = null;
    currentTrendLabel: HTMLElement | null = null;
    trendRecommendation: HTMLElement | null = null;
    suggestedProfile: HTMLElement | null = null;
    currentSuggestedProfile: { hot: number; neutral: number; cold: number; starHot?: number; starNeutral?: number; starCold?: number } = { hot: 2, neutral: 3, cold: 1 };

  constructor() {
    // Estado del sistema
    this.selectedNumbers = new Set();
    this.selectedStars = new Set();
    this.suggestedNumbers = new Set();
    this.suggestedStars = new Set();
    this.excludedNumbers = new Set();
    this.excludedStars = new Set();
    this.hotNumbers = new Set();
    this.hotStars = new Set();
    this.coldNumbers = new Set();
    this.coldStars = new Set();
    this.absentNumbers = new Set();
    this.absentStars = new Set();
    this.favoriteNumbers = new Set();
    this.favoriteStars = new Set();
    this.favoriteGames = new Set();
    this.currentGame = GAMES['bonoloto'];
    this.customGameUrls = {
        bonoloto: '',
        primitiva: '',
        euromillones: '',
        eurodreams: '',
        gordo: ''
    };
    this.filterPresets = [];
    this.gameFilters = {};
    
    // Initialize default filters for each game
    Object.keys(GAMES).forEach(id => {
        this.gameFilters[id] = this.getDefaultFiltersForGame(id);
    });

    this.currentSelectionMode = null; // null | 'excluded' | 'hot' | 'cold' | 'figure' | 'absent' | 'favorites'
    this.isGenerating = false;
    this.activeDashboardFilters = new Set();
    this.lastDebugInfo = '';
    this.lastMultipleStats = null;
    this.savedTickets = [];
    this.currentTicket = null;
    this.currentValidatingTicket = null;
    this.historicalData = [];
    this.numberStats = {};
    this.starStats = {};
    this.analysisPeriod = 100;
    this.dataLoaded = false;
    this.dataType = 'none';

    // Initialize UI elements
    this.aiPredictBtn = document.getElementById('aiPredictBtn');
    this.correlationScoreContainer = document.getElementById('correlationScoreContainer');
    this.correlationScoreValue = document.getElementById('correlationScoreValue');
    this.correlationScoreBar = document.getElementById('correlationScoreBar');
    this.correlationAdvice = document.getElementById('correlationAdvice');

    // Initialize Trend UI elements
    this.drawTrendPanel = document.getElementById('drawTrendPanel');
    this.currentTrendLabel = document.getElementById('currentTrendLabel');
    this.trendRecommendation = document.getElementById('trendRecommendation');
    this.suggestedProfile = document.getElementById('suggestedProfile');

    this.filters = this.gameFilters[this.currentGame.id];
    
    // Constantes y pre-cálculos
    this.primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
    this.TOLERANCE_LEVELS = { // Niveles de tolerancia para la estrategia Múltiple
        7: 0.70,
        8: 0.50,
        9: 0.35,
        10: 0.25,
        11: 0.20
    };
    
    this.init();
  }

  init() {
    this.createNumbersGrid();
    this.loadState();
    this.updateSidebarGameOrder();
    this.updateUIFromFilterState();
    this.initializeHistoricalData();
    this.analyzeNumbers();
    this.updateGridNumberStates();
    this.bindEvents();
    this.updateSavedTickets();
    this.updateDataAnalysis();
    this.updateFilterBadgesFromAudit();
    
    // Initialize Big Data with current day selected
    const daySelect = document.getElementById('nextDrawDay') as HTMLSelectElement;
    if (daySelect) {
        daySelect.value = String(new Date().getDay());
    }
    this.updateBigDataPanel();

    // Trigger runSelfDiagnostics on startup
    setTimeout(() => {
        try {
            this.runSelfDiagnostics();
        } catch (diagErr) {
            console.error("No se pudo iniciar el auto-diagnóstico:", diagErr);
        }
    }, 100);
  }

  runSelfDiagnostics() {
    console.log("=== INICIANDO PRUEBAS DE DIAGNÓSTICO DATALOTTO PLATAFORMA ===");
    const diagResults: { name: string; status: 'PASS' | 'WARN' | 'FAIL'; msg: string }[] = [];

    // Test 1: LocalStorage Access
    try {
        const testKey = '__datalotto_diag_test__';
        localStorage.setItem(testKey, '1');
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        if (retrieved === '1') {
            diagResults.push({ name: 'Acceso a LocalStorage', status: 'PASS', msg: 'Lectura y escritura correcta de persistencia en caché' });
        } else {
            diagResults.push({ name: 'Acceso a LocalStorage', status: 'WARN', msg: 'No se persistieron los datos correctamente' });
        }
    } catch (e: any) {
        diagResults.push({ name: 'Acceso a LocalStorage', status: 'FAIL', msg: `Sandbox/WebView limita almacenamiento: ${e.message}` });
    }

    // Test 2: DOM elements integrity check
    const elementsToVerify = ['numbersGrid', 'generateBtn', 'savedTickets', 'savedTicketsGameFilter'];
    const missingElements = elementsToVerify.filter(id => !document.getElementById(id));
    if (missingElements.length === 0) {
        diagResults.push({ name: 'Integridad del DOM', status: 'PASS', msg: 'Todos los elementos y selectores de la app cargados correctamente' });
    } else {
        diagResults.push({ name: 'Integridad del DOM', status: 'FAIL', msg: `Elementos de la interfaz ausentes: ${missingElements.join(', ')}` });
    }

    // Test 3: Math filters check
    try {
        const testCombo = [1, 2, 3, 4, 5, 6];
        const stats = this.getCombinationStats(testCombo);
        if (stats && stats.suma === 21) {
            diagResults.push({ name: 'Motor Matemático Interno', status: 'PASS', msg: 'Estadísticas y ecuaciones probabilísticas estables' });
        } else {
            diagResults.push({ name: 'Motor Matemático Interno', status: 'FAIL', msg: 'La suma no coincide con el cálculo del motor' });
        }
    } catch (mathErr: any) {
        diagResults.push({ name: 'Motor Matemático Interno', status: 'FAIL', msg: `Fallo de cálculo matemático: ${mathErr.message}` });
    }

    console.table(diagResults);

    // Dynamic State indicator Badge on top Header
    const brandElement = document.querySelector('.logo') || document.querySelector('.header');
    if (brandElement) {
        // Safe remove if already exists
        document.getElementById('datalotto-diagnostics-badge')?.remove();

        const badge = document.createElement('span');
        badge.id = 'datalotto-diagnostics-badge';
        badge.style.cssText = 'font-size: 0.75rem; margin-left: 10px; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; font-weight: 500; cursor: pointer; transition: transform 0.2s;';
        
        const hasFailures = diagResults.some(r => r.status === 'FAIL');
        const hasWarnings = diagResults.some(r => r.status === 'WARN');
        
        if (hasFailures) {
            badge.style.color = '#ef4444';
            badge.style.background = '#fef2f2';
            badge.style.border = '1px solid #fecaca';
            badge.textContent = '● Diagnóstico: Crítico 🚨';
        } else if (hasWarnings) {
            badge.style.color = '#f97316';
            badge.style.background = '#fffaf5';
            badge.style.border = '1px solid #fed7aa';
            badge.textContent = '● Diagnóstico: Aviso ⚠️';
        } else {
            badge.style.color = '#10b981';
            badge.style.background = '#f0fdf4';
            badge.style.border = '1px solid #bbf7d0';
            badge.textContent = '● Plataforma multi-juego: OK ✓';
        }

        badge.onclick = (e) => {
            e.stopPropagation();
            this.showToast(`Estado de la app: ${hasFailures ? 'Requiere atención' : 'Perfecto y listo para lanzar!'}. Revisa la consola de depuración.`, hasFailures ? 'error' : 'success');
        };

        brandElement.appendChild(badge);
    }
  }

  runFilterAudit(sampleSize = 500) {
    const availableUniverse = this.getAvailableUniverse('number');
    const availableStars = this.getAvailableUniverse('star');
    const maxNumbers = this.currentGame.maxNumbers;
    const maxStars = this.currentGame.maxStars;

    const results: { [key: string]: { name: string; count: number; passed: number; percent: number } } = {
      sum: { name: 'Rango de Suma Total', count: 0, passed: 0, percent: 100 },
      terminacionesDistintas: { name: 'Variedad de Terminaciones', count: 0, passed: 0, percent: 100 },
      parImpar: { name: 'Balance Par/Impar', count: 0, passed: 0, percent: 100 },
      bajosAltos: { name: 'Balance Bajos/Altos', count: 0, passed: 0, percent: 100 },
      primos: { name: 'Cantidad de Primos', count: 0, passed: 0, percent: 100 },
      distancia: { name: 'Distancia entre Números', count: 0, passed: 0, percent: 100 },
      sumaDigitos: { name: 'Suma de Dígitos', count: 0, passed: 0, percent: 100 },
      consecutivos: { name: 'Bloques Consecutivos', count: 0, passed: 0, percent: 100 },
      agrupDecenas: { name: 'Agrupación por Decenas', count: 0, passed: 0, percent: 100 },
      desviacion: { name: 'Desviación Estándar', count: 0, passed: 0, percent: 100 },
      entropyTerminaciones: { name: 'Entropía (Terminaciones)', count: 0, passed: 0, percent: 100 },
      entropyIntervalos: { name: 'Entropía (Intervalos)', count: 0, passed: 0, percent: 100 },
      geometric: { name: 'Exclusión Geométrica', count: 0, passed: 0, percent: 100 }
    };

    if (maxStars > 0) {
      results.starSum = { name: 'Suma de Estrellas', count: 0, passed: 0, percent: 100 };
      results.starParImpar = { name: 'Estrellas Par/Impar', count: 0, passed: 0, percent: 100 };
      results.starBajosAltos = { name: 'Estrellas Bajos/Altos', count: 0, passed: 0, percent: 100 };
      results.starSumaDigitos = { name: 'Estrellas Suma de Dígitos', count: 0, passed: 0, percent: 100 };
      results.starPrimos = { name: 'Estrellas Primos', count: 0, passed: 0, percent: 100 };
      results.starConsecutivos = { name: 'Estrellas Consecutivas', count: 0, passed: 0, percent: 100 };
      results.starDistancia = { name: 'Estrellas Distancia', count: 0, passed: 0, percent: 100 };
    }

    let actualSampleSize = 0;
    for (let i = 0; i < sampleSize; i++) {
        const combo = this.generateRandomCombination(availableUniverse, maxNumbers);
        const stars = maxStars > 0 ? this.generateRandomCombination(availableStars, maxStars) : [];
        if (combo.length !== maxNumbers) continue;
        if (maxStars > 0 && stars.length !== maxStars) continue;

        actualSampleSize++;

        // Examen de Suma
        let sum = 0;
        for (let j = 0; j < maxNumbers; j++) sum += combo[j];
        if (this.filters.sum) {
            results.sum.count++;
            if (sum >= this.filters.sum.min && sum <= this.filters.sum.max) results.sum.passed++;
        }

        // Variedad terminaciones
        if (this.filters.terminacionesDistintas && this.filters.terminacionesDistintas.length > 0) {
            results.terminacionesDistintas.count++;
            const uniqueEndings = new Set(combo.map(n => n % 10)).size;
            if (this.filters.terminacionesDistintas.includes(uniqueEndings)) results.terminacionesDistintas.passed++;
        }

        // Par Impar
        if (this.filters.parImpar && this.filters.parImpar.length > 0) {
            results.parImpar.count++;
            const evens = combo.filter(n => n % 2 === 0).length;
            const parImparKey = `${evens}/${maxNumbers - evens}`;
            if (this.filters.parImpar.includes(parImparKey)) results.parImpar.passed++;
        }

        // Bajos Altos
        if (this.filters.bajosAltos && this.filters.bajosAltos.length > 0) {
            results.bajosAltos.count++;
            const midPoint = Math.floor(this.currentGame.numberRange / 2);
            const lows = combo.filter(n => n <= midPoint).length;
            const bajosAltosKey = `${lows}/${maxNumbers - lows}`;
            if (this.filters.bajosAltos.includes(bajosAltosKey)) results.bajosAltos.passed++;
        }

        // Primos
        if (this.filters.primos) {
            results.primos.count++;
            const primesCount = combo.filter(n => this.primes.has(n)).length;
            if (primesCount >= this.filters.primos.min && primesCount <= this.filters.primos.max) results.primos.passed++;
        }

        // Distancia
        if (this.filters.distancia) {
            results.distancia.count++;
            const sortedCombo = [...combo].sort((a,b) => a-b);
            let passDist = true;
            for (let j = 0; j < sortedCombo.length - 1; j++) {
                const diff = sortedCombo[j+1] - sortedCombo[j];
                if (diff < this.filters.distancia.min || diff > this.filters.distancia.max) {
                    passDist = false;
                    break;
                }
            }
            if (passDist) results.distancia.passed++;
        }

        // Suma Digitos
        if (this.filters.sumaDigitos) {
            results.sumaDigitos.count++;
            const digitSum = combo.reduce((s, num) => s + (num < 10 ? num : (num % 10 + Math.floor(num/10))), 0);
            if (digitSum >= this.filters.sumaDigitos.min && digitSum <= this.filters.sumaDigitos.max) results.sumaDigitos.passed++;
        }

        // Consecutivos
        if (this.filters.consecutivos && this.filters.consecutivos.length > 0) {
            results.consecutivos.count++;
            const sorted = [...combo].sort((a,b)=>a-b);
            let consecutivePattern = '';
            let count = 1;
            for (let j = 1; j < sorted.length; j++) {
                if (sorted[j] === sorted[j-1] + 1) {
                    count++;
                } else {
                    consecutivePattern += count;
                    count = 1;
                }
            }
            consecutivePattern += count;
            const consecPatternSorted = consecutivePattern.split('').sort((a,b)=>Number(b)-Number(a)).join('/');
            if (this.filters.consecutivos.includes(consecPatternSorted)) results.consecutivos.passed++;
        }

        // Decenas
        if (this.filters.agrupDecenas && this.filters.agrupDecenas.length > 0) {
            results.agrupDecenas.count++;
            const tens: { [key: number]: number } = {};
            combo.forEach(n => {
                const ten = Math.floor((n-1)/10);
                tens[ten] = (tens[ten] || 0) + 1;
            });
            const tensGroups = Object.values(tens).sort((a,b)=>b-a).join('/');
            if (this.filters.agrupDecenas.includes(tensGroups)) results.agrupDecenas.passed++;
        }

        // Desviacion
        if (this.filters.desviacion) {
            results.desviacion.count++;
            const mean = sum / maxNumbers;
            const stdDev = Math.sqrt(combo.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / maxNumbers);
            if (stdDev >= this.filters.desviacion.min && stdDev <= this.filters.desviacion.max) results.desviacion.passed++;
        }

        // Entropía de Terminaciones
        if (this.filters.entropyTerminaciones) {
            results.entropyTerminaciones.count++;
            const endingCounts: { [key: number]: number } = {};
            combo.forEach(n => {
                const ending = n % 10;
                endingCounts[ending] = (endingCounts[ending] || 0) + 1;
            });
            const entropyTerm = -Object.values(endingCounts).reduce((s, countVal) => {
                const p = countVal / maxNumbers;
                return s + p * Math.log2(p);
            }, 0);
            if (entropyTerm >= this.filters.entropyTerminaciones.min && entropyTerm <= this.filters.entropyTerminaciones.max) {
                results.entropyTerminaciones.passed++;
            }
        }

        // Entropía de Intervalos
        if (this.filters.entropyIntervalos) {
            results.entropyIntervalos.count++;
            const sortedCombo = [...combo].sort((a,b) => a-b);
            const intervalCounts: { [key: number]: number } = {};
            for (let idx = 0; idx < sortedCombo.length - 1; idx++) {
                const diff = sortedCombo[idx+1] - sortedCombo[idx];
                intervalCounts[diff] = (intervalCounts[diff] || 0) + 1;
            }
            const numIntervals = maxNumbers - 1;
            const entropyInt = -Object.values(intervalCounts).reduce((s, countVal) => {
                const p = countVal / numIntervals;
                return s + p * Math.log2(p);
            }, 0);
            if (entropyInt >= this.filters.entropyIntervalos.min && entropyInt <= this.filters.entropyIntervalos.max) {
                results.entropyIntervalos.passed++;
            }
        }

        // Geometric
        const hasGeomActive = (this.filters.geometric && 
                               ((this.filters.geometric.exclude && this.filters.geometric.exclude.length > 0) ||
                                (this.filters.geometric.favor && this.filters.geometric.favor.length > 0)));
        if (hasGeomActive) {
            results.geometric.count++;
            let comboPassed = true;
            if (this.filters.geometric.exclude && this.filters.geometric.exclude.length > 0) {
                if (this.hasGeometricPattern(combo, this.filters.geometric.exclude)) comboPassed = false;
            }
            if (this.filters.geometric.favor && this.filters.geometric.favor.includes('espaciados')) {
                if (!this.isSpaced(combo)) comboPassed = false;
            }
            if (comboPassed) results.geometric.passed++;
        }

        // Stars
        if (maxStars > 1) {
            const starSum = stars.reduce((a, b) => a + b, 0);
            if (this.filters.starSum) {
                results.starSum.count++;
                if (starSum >= this.filters.starSum.min && starSum <= this.filters.starSum.max) results.starSum.passed++;
            }
            if (this.filters.starParImpar && this.filters.starParImpar.length > 0) {
                results.starParImpar.count++;
                const starEvens = stars.filter(n => n % 2 === 0).length;
                const starParImparKey = `${starEvens}/${maxStars-starEvens}`;
                if (this.filters.starParImpar.includes(starParImparKey)) results.starParImpar.passed++;
            }
            if (this.filters.starBajosAltos && this.filters.starBajosAltos.length > 0) {
                results.starBajosAltos.count++;
                const starMid = Math.floor(this.currentGame.starRange / 2);
                const starLows = stars.filter(n => n <= starMid).length;
                const starBajosAltosKey = `${starLows}/${maxStars-starLows}`;
                if (this.filters.starBajosAltos.includes(starBajosAltosKey)) results.starBajosAltos.passed++;
            }
            if (this.filters.starSumaDigitos) {
                results.starSumaDigitos.count++;
                let starDigitSum = 0;
                stars.forEach(s => {
                    const sStr = s.toString();
                    for (let j = 0; j < sStr.length; j++) starDigitSum += parseInt(sStr[j]);
                });
                if (starDigitSum >= this.filters.starSumaDigitos.min && starDigitSum <= this.filters.starSumaDigitos.max) results.starSumaDigitos.passed++;
            }
            if (this.filters.starPrimos) {
                results.starPrimos.count++;
                const starPrimosVal = stars.filter(n => this.primes.has(n)).length;
                if (starPrimosVal >= this.filters.starPrimos.min && starPrimosVal <= this.filters.starPrimos.max) results.starPrimos.passed++;
            }
            if (this.filters.starConsecutivos && this.filters.starConsecutivos.length > 0) {
                results.starConsecutivos.count++;
                const sortedStars = [...stars].sort((a,b)=>a-b);
                let starConsecPattern = '';
                let sCount = 1;
                for (let j = 1; j < sortedStars.length; j++) {
                    if (sortedStars[j] === sortedStars[j-1] + 1) {
                        sCount++;
                    } else {
                        starConsecPattern += sCount;
                        sCount = 1;
                    }
                }
                starConsecPattern += sCount;
                const starConsecPatternSorted = starConsecPattern.split('').sort((a,b)=>Number(b)-Number(a)).join('/');
                if (this.filters.starConsecutivos.includes(starConsecPatternSorted)) results.starConsecutivos.passed++;
            }
            if (this.filters.starDistancia) {
                results.starDistancia.count++;
                const sortedStars = [...stars].sort((a,b)=>a-b);
                let minStarDist = 99;
                for (let j = 0; j < sortedStars.length - 1; j++) {
                    const d = sortedStars[j+1] - sortedStars[j];
                    if (d < minStarDist) minStarDist = d;
                }
                if (minStarDist >= this.filters.starDistancia.min && minStarDist <= this.filters.starDistancia.max) results.starDistancia.passed++;
            }
        }
    }

    for (const key in results) {
      if (results[key].count > 0) {
        results[key].percent = Math.round((results[key].passed / results[key].count) * 100);
      } else {
        results[key].percent = 100;
      }
    }

    return { results, actualSampleSize };
  }

  displayFilterFailureDiagnostics() {
    const ticketDiv = document.getElementById('ticket');
    if (!ticketDiv) return;

    this.updateFilterStateFromUI();
    const { results, actualSampleSize } = this.runFilterAudit(1000);

    // Filter results so we only show active filters that actually restrict combinations (percent < 100)
    const activeFilters = Object.keys(results)
      .map(key => ({ key, ...results[key] }))
      .filter(item => item.count > 0 && item.percent < 100);

    ticketDiv.classList.add('show', 'conflict');
    
    if (activeFilters.length === 0) {
      ticketDiv.innerHTML = `
        <div class="ticket-header" style="border-bottom: 2px solid #fee2e2; margin-bottom: 12px; padding-bottom: 10px;">
          <h4 style="color: #dc2626; display: flex; align-items: center; gap: 8px; margin: 0; font-weight: bold;">⚠️ Generación Incompleta</h4>
          <span style="font-size: 0.8rem; color: #7f1d1d; font-weight: bold;">Filtros Extremos</span>
        </div>
        <div style="padding: 10px 5px; color: #7f1d1d; font-size: 0.9rem; line-height: 1.5;">
          <p style="margin: 0 0 10px 0; font-weight: bold;">No se han podido encontrar combinaciones válidas en 50,000 intentos.</p>
          <p style="margin: 0 0 15px 0; color: #991b1b; font-size: 0.85rem;">El universo seleccionado en el volante interactivo es demasiado bajo o hay un conflicto estricto en los filtros avanzados configurados.</p>
          <button id="resetDiagFiltersBtn" style="width: 100%; padding: 12px; background: #dc2626; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background 0.2s; font-size: 0.9rem;">
            🔄 Restablecer Filtros de ${this.currentGame.name}
          </button>
        </div>
      `;
    } else {
      activeFilters.sort((a, b) => a.percent - b.percent);

      let filtersHtml = '';
      activeFilters.forEach((item, index) => {
        const isCritical = item.percent < 8;
        const isBottleneck = index === 0 && item.percent < 30;
        const barColor = isCritical ? '#ef4444' : isBottleneck ? '#f97316' : '#10b981';
        const labelText = isCritical ? 'Bloqueo Crítico 🚨' : isBottleneck ? 'Filtro Restrictivo ⚠️' : 'Filtro Activo';
        
        let recommendation = '';
        if (item.key === 'sum') {
          recommendation = '💡 Amplía el Rango de Suma en el panel de control avanzado.';
        } else if (item.key === 'terminacionesDistintas') {
          recommendation = '💡 Permite mayor variedad de terminaciones distintas.';
        } else if (item.key === 'parImpar') {
          recommendation = '💡 Activa más combinaciones de proporción Par/Impar.';
        } else if (item.key === 'bajosAltos') {
          recommendation = '💡 Activa más alternativas para proporción Bajos/Altos.';
        } else if (item.key === 'primos') {
          recommendation = '💡 Amplía los límites mínimo o máximo de cantidad de primos.';
        } else if (item.key === 'distancia') {
          recommendation = '💡 Relaja la distancia mínima de espaciado o aumenta la máxima.';
        } else if (item.key === 'sumaDigitos') {
          recommendation = '💡 Amplía los márgenes de suma de dígitos individuales.';
        } else if (item.key === 'consecutivos') {
          recommendation = '💡 Selecciona más patrones de bloques consecutivos permitidos.';
        } else if (item.key === 'agrupDecenas') {
          recommendation = '💡 Permite más patrones de agrupación por decenas.';
        } else if (item.key === 'desviacion') {
          recommendation = '💡 Amplía el rango de desviación estándar permitida.';
        } else if (item.key === 'entropyTerminaciones') {
          recommendation = '💡 Amplía los límites de Entropía de Terminaciones para mayor variedad de finales.';
        } else if (item.key === 'entropyIntervalos') {
          recommendation = '💡 Ajusta la Entropía de Intervalos para permitir un espaciado de números más flexible.';
        } else if (item.key === 'geometric') {
          recommendation = '💡 Desmarca patrones visuales excluidos en el panel geométrico.';
        } else if (item.key?.startsWith('star')) {
          recommendation = '💡 Flexibiliza filtros específicos aplicados para las estrellas.';
        }

        filtersHtml += `
          <div style="background: ${isCritical ? '#fff5f5' : '#fffaf5'}; border: 1px solid ${isCritical ? '#fecaca' : '#fed7aa'}; padding: 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
              <span style="font-weight: bold; color: #1e293b;">${item.name}</span>
              <span style="font-weight: 900; color: ${barColor}">${item.percent}% aprueban</span>
            </div>
            <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
              <div style="width: ${item.percent}%; height: 100%; background: ${barColor}; border-radius: 3px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b;">
              <span>${item.passed} de ${item.count} apuestas de prueba pasaron</span>
              <span style="font-weight: bold; color: ${barColor}">${labelText}</span>
            </div>
            ${recommendation ? `<div style="font-size: 0.75rem; color: #991b1b; margin-top: 4px; padding: 5px 8px; background: #fee2e2; border-radius: 4px; border-left: 2px solid ${barColor}; font-weight: 500;">${recommendation}</div>` : ''}
          </div>
        `;
      });

      ticketDiv.innerHTML = `
        <div class="ticket-header" style="border-bottom: 2px solid #fee2e2; margin-bottom: 12px; padding-bottom: 10px;">
          <h4 style="color: #dc2626; display: flex; align-items: center; gap: 8px; margin: 0; font-weight: bold;">⚠️ Conflicto de Filtros Detectado</h4>
          <span style="font-size: 0.8rem; color: #7f1d1d; font-weight: bold;">Auditoría de Embudo</span>
        </div>
        <div style="padding: 0 5px; display: flex; flex-direction: column; gap: 15px;">
          <div style="color: #7f1d1d; font-size: 0.85rem; line-height: 1.5; background: #fee2e2; padding: 10px; border-radius: 6px; border-left: 4px solid #ef4444;">
            <strong>⚠️ Bloqueo matemático detectado:</strong> No se han podido encontrar apuestas viables en 50,000 intentos.
            Nuestro auditor ha analizado tus filtros mediante simulaciones de prueba en tiempo real para encontrar el embudo:
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${filtersHtml}
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 5px;">
            <button id="resetDiagFiltersBtn" style="width: 100%; padding: 12px; background: #dc2626; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: transform 0.1s, background 0.2s; font-size: 0.9rem; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.23);">
              🔄 Restablecer Filtros de ${this.currentGame.name}
            </button>
            <p style="font-size: 0.75rem; color: #64748b; text-align: center; margin: 0;">
              Esto cargará los rangos recomendados diseñados por el motor de probabilidades para que la generación funcione de inmediato.
            </p>
          </div>
        </div>
      `;
    }

    const resetBtn = document.getElementById('resetDiagFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        try {
          this.resetFiltersToDefault();
          this.showToast(`✅ Filtros de ${this.currentGame.name} restablecidos a valores recomendados.`, 'success');
          ticketDiv.classList.remove('show', 'conflict');
        } catch (err: any) {
          console.error("Fallo al resetear filtros:", err);
        }
      });
    }

    // Scroll to ticket with safety delay and mobile optimization
    setTimeout(() => {
        try {
            ticketDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) {
            ticketDiv.scrollIntoView();
        }
    }, 150);
  }

  resetFiltersToDefault() {
    const defaultFilters = this.getDefaultFiltersForGame(this.currentGame.id);
    this.filters = JSON.parse(JSON.stringify(defaultFilters));
    this.gameFilters[this.currentGame.id] = this.filters;
    this.saveState();
    this.updateUIFromFilterState();
  }

  updateFilterBadgesFromAudit() {
    this.updateFilterStateFromUI();
    const { results } = this.runFilterAudit(500);

    const filterSelectors: { [key: string]: string } = {
      terminaciones: '#terminacionesOptions',
      sum: '#sumMin',
      terminacionesDistintas: '#terminacionesDistintasOptions',
      parImpar: '#parImparOptions',
      bajosAltos: '#bajosAltosOptions',
      primos: '#primosMin',
      distancia: '#distanciaMin',
      sumaDigitos: '#sumaDigitosMin',
      consecutivos: '#consecutivosOptions',
      agrupDecenas: '#agrupDecenasOptions',
      desviacion: '#desviacionMin',
      entropyTerminaciones: '#entropyTerminacionesMin',
      entropyIntervalos: '#entropyIntervalosMin',
      geometric: '#geometricOptions',
      starSum: '#starSumMin',
      starParImpar: '#starParImparOptions',
      starBajosAltos: '#starBajosAltosOptions',
      starSumaDigitos: '#starSumaDigitosMin',
      starPrimos: '#starPrimosMin',
      starConsecutivos: '#starConsecutivosOptions',
      starDistancia: '#starDistanciaMin'
    };

    // Remove any existing custom activity badges inside ALL .filter-title elements
    document.querySelectorAll('.filter-title .filter-activity-badge').forEach(el => el.remove());

    Object.keys(results).forEach(key => {
      const item = results[key];
      // Only show badge if the filter was actually evaluated (count > 0)
      // and it restricted combinations (percent < 100), OR if it's the geometric filter
      if (item.count > 0 && (item.percent < 100 || key === 'geometric')) {
        const selector = filterSelectors[key];
        if (!selector) return;

        const targetEl = document.querySelector(selector);
        if (!targetEl) return;

        const filterGroup = targetEl.closest('.filter-group');
        if (!filterGroup) return;

        const titleEl = filterGroup.querySelector('.filter-title');
        if (!titleEl) return;

        // Create elegant styled badge
        const badge = document.createElement('span');
        badge.className = 'filter-activity-badge';
        badge.style.cssText = 'font-size: 0.72rem; margin-left: 8px; display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.02em; animation: pulse 2s infinite ease-in-out; border-width: 1px; border-style: solid;';

        const isCritical = item.percent < 15;
        const isWarning = item.percent < 50;

        if (isCritical) {
          badge.style.color = '#ef4444';
          badge.style.background = '#fee2e2';
          badge.style.borderColor = '#fca5a5';
          badge.innerHTML = `🚨 Filtra ${Math.round(100 - item.percent)}%`;
        } else if (isWarning) {
          badge.style.color = '#d97706';
          badge.style.background = '#fef3c7';
          badge.style.borderColor = '#fcd34d';
          badge.innerHTML = `⚠️ Filtra ${Math.round(100 - item.percent)}%`;
        } else {
          badge.style.color = '#3b82f6';
          badge.style.background = '#eff6ff';
          badge.style.borderColor = '#93c5fd';
          badge.innerHTML = `📉 Filtra ${Math.round(100 - item.percent)}%`;
        }

        titleEl.appendChild(badge);
      }
    });
  }

  normalizeFilters(filters: any, gameId: string): Filters {
      const defaults = this.getDefaultFiltersForGame(gameId);
      if (!filters) return defaults;
      if (!filters.entropyTerminaciones) {
          filters.entropyTerminaciones = defaults.entropyTerminaciones;
      }
      if (!filters.entropyIntervalos) {
          filters.entropyIntervalos = defaults.entropyIntervalos;
      }
      return filters;
  }

  getDefaultFiltersForGame(gameId: string): Filters {
      const game = GAMES[gameId];
      const maxNumbers = game.maxNumbers;
      const numberRange = game.numberRange;
      const maxStars = game.maxStars;
      const starRange = game.starRange;

      // Default number ranges
      let sumMin = 0; for(let i=1; i<=maxNumbers; i++) sumMin += i;
      let sumMax = 0; for(let i=0; i<maxNumbers; i++) sumMax += (numberRange - i);
      
      // Heuristic for default sum range (middle 40%)
      const range = sumMax - sumMin;
      const defaultSumMin = Math.floor(sumMin + range * 0.3);
      const defaultSumMax = Math.floor(sumMin + range * 0.7);

      return {
          terminaciones: [],
          terminacionesDistintas: [maxNumbers - 2, maxNumbers - 1, maxNumbers],
          sum: { min: defaultSumMin, max: defaultSumMax },
          parImpar: [],
          bajosAltos: [],
          primos: { min: 1, max: Math.floor(maxNumbers / 2) },
          consecutivos: [],
          distancia: { min: 1, max: Math.floor(numberRange / 2) },
          agrupDecenas: [],
          sumaDigitos: { min: Math.floor(maxNumbers * 4.5), max: Math.floor(maxNumbers * 7.5) },
          desviacion: { min: 10.0, max: 20.0 },
          entropyTerminaciones: { min: 1.000, max: Number(Math.log2(maxNumbers).toFixed(3)) },
          entropyIntervalos: { min: 1.000, max: Number(Math.log2(maxNumbers - 1).toFixed(3)) },
          geometric: { exclude: [], favor: [] },
          starSum: { min: 3, max: starRange * 1.5 },
          starParImpar: [],
          starBajosAltos: [],
          starSumaDigitos: { min: 2, max: 15 },
          starPrimos: { min: 0, max: maxStars },
          starConsecutivos: [],
          starDistancia: { min: 1, max: starRange - 1 },
          useMarkov: false,
          useNash: false,
          useRegression: false,
          ai: {
              markovDepth: 5,
              nashWeight: 1,
              regressionBonus: 3
          }
      };
  }

  // ===== PERSISTENCIA DE DATOS =====
  saveState() {
      try {
          // Update current game filters in the map before saving
          this.gameFilters[this.currentGame.id] = this.filters;

          const state = {
              savedTickets: this.savedTickets,
              gameFilters: this.gameFilters, // Save all game filters
              historicalData: this.historicalData,
              dataType: this.dataType,
              dataLoaded: this.dataLoaded,
              favoriteNumbers: Array.from(this.favoriteNumbers), // Persist favorites
              favoriteGames: Array.from(this.favoriteGames), // Persist game favorites
              customGameUrls: this.customGameUrls, // Persist custom URLs
              filterPresets: this.filterPresets, // Persist filter presets
          };
          localStorage.setItem(DataLotto49Advanced.APP_STATE_KEY, JSON.stringify(state));
      } catch (error) {
          console.error("Error guardando el estado:", error);
          this.showToast('Error al guardar el estado de la app', 'error');
      }
  }

  openSaveFilterModal() {
      const input = document.getElementById('filterPresetName') as HTMLInputElement;
      if (input) input.value = '';
      this.toggleModal('saveFilterModal', true);
  }

  confirmSaveFilter() {
      const input = document.getElementById('filterPresetName') as HTMLInputElement;
      const name = input?.value.trim() || `Filtro ${new Date().toLocaleDateString()}`;
      
      const newPreset: FilterPreset = {
          id: Date.now().toString(),
          name: name,
          date: new Date().toLocaleString(),
          filters: JSON.parse(JSON.stringify(this.filters)) // Deep copy
      };

      this.filterPresets.push(newPreset);
      this.saveState();
      this.toggleModal('saveFilterModal', false);
      this.showToast(`✅ Filtro "${name}" guardado correctamente.`, 'success');
  }

  openLoadFilterModal() {
      this.renderFilterPresetsList();
      this.toggleModal('loadFilterModal', true);
  }

  renderFilterPresetsList() {
      const container = document.getElementById('filterPresetsList');
      if (!container) return;
      container.innerHTML = '';

      if (this.filterPresets.length === 0) {
          container.innerHTML = '<div style="color:#666; text-align: center; padding: 10px;">No tienes filtros guardados.</div>';
          return;
      }

      this.filterPresets.forEach(preset => {
          const item = document.createElement('div');
          item.className = 'preset-item';
          
          const info = document.createElement('div');
          info.className = 'preset-info';
          info.innerHTML = `
              <div class="preset-name">${preset.name}</div>
              <div class="preset-date">${preset.date}</div>
          `;
          info.onclick = () => this.loadFilterPreset(preset.id);

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'preset-delete-btn';
          deleteBtn.innerHTML = '✕';
          deleteBtn.onclick = (e) => {
              e.stopPropagation();
              this.deleteFilterPreset(preset.id);
          };

          item.appendChild(info);
          item.appendChild(deleteBtn);
          container.appendChild(item);
      });
  }

  loadFilterPreset(id: string) {
      const preset = this.filterPresets.find(p => p.id === id);
      if (!preset) return;

      this.filters = JSON.parse(JSON.stringify(preset.filters));
      this.updateUIFromFilterState();
      this.toggleModal('loadFilterModal', false);
      this.showToast(`📂 Filtro "${preset.name}" cargado.`, 'success');
  }

  deleteFilterPreset(id: string) {
      this.filterPresets = this.filterPresets.filter(p => p.id !== id);
      this.saveState();
      this.renderFilterPresetsList();
      this.showToast('Filtro eliminado.', 'info');
  }

  async applyAiFilters() {
      if (!this.dataLoaded || this.historicalData.length === 0) {
          this.showToast('Primero carga la base de datos de un juego.', 'warning');
          return;
      }

      this.showToast('🤖 Gemini está analizando el historial para generar filtros óptimos...', 'info');

      // Obtener los 25 sorteos más recientes
      const recentDraws = this.historicalData.slice(-25).map(d => ({
          numbers: d.numbers,
          stars: d.stars,
          date: d.date instanceof Date ? d.date.toLocaleDateString() : String(d.date)
      })).reverse(); // El más reciente primero

      const gamePayload = {
          id: this.currentGame.id,
          name: this.currentGame.name,
          numberRange: this.currentGame.numberRange,
          maxNumbers: this.currentGame.maxNumbers,
          starRange: this.currentGame.starRange,
          maxStars: this.currentGame.maxStars
      };

      const statsPayload = {
          hotNumbers: Array.from(this.hotNumbers),
          coldNumbers: Array.from(this.coldNumbers),
          absentNumbers: Array.from(this.absentNumbers),
          hotStars: Array.from(this.hotStars),
          coldStars: Array.from(this.coldStars),
          absentStars: Array.from(this.absentStars)
      };

      try {
          const response = await fetch('/api/ai-filters', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  game: gamePayload,
                  recentDraws: recentDraws,
                  stats: statsPayload
              })
          });

          if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP error ${response.status}`);
          }

          const recommended = await response.json();

          // 1. Limpiar exclusiones manuales actuales
          this.excludedNumbers.clear();
          this.excludedStars.clear();

          // 2. Cargar exclusiones recomendadas por la IA (Garantizando rangos válidos)
          if (Array.isArray(recommended.excludedNumbers)) {
              recommended.excludedNumbers.forEach((n: number) => {
                  if (n >= 1 && n <= this.currentGame.numberRange) {
                      this.excludedNumbers.add(n);
                  }
              });
          }

          if (this.currentGame.maxStars > 0 && Array.isArray(recommended.excludedStars)) {
              recommended.excludedStars.forEach((n: number) => {
                  if (n >= 1 && n <= this.currentGame.starRange) {
                      this.excludedStars.add(n);
                  }
              });
          }

          // 3. Cargar los filtros estructurados recomendados por la IA en memoria
          if (Array.isArray(recommended.terminaciones)) {
              this.filters.terminaciones = recommended.terminaciones.filter((n: number) => n >= 0 && n <= 9);
          }
          if (Array.isArray(recommended.terminacionesDistintas)) {
              this.filters.terminacionesDistintas = recommended.terminacionesDistintas;
          }

          if (recommended.sum && typeof recommended.sum.min === 'number') {
              this.filters.sum = { min: recommended.sum.min, max: recommended.sum.max };
          }
          if (Array.isArray(recommended.parImpar)) {
              this.filters.parImpar = recommended.parImpar;
          }
          if (Array.isArray(recommended.bajosAltos)) {
              this.filters.bajosAltos = recommended.bajosAltos;
          }
          if (recommended.primos && typeof recommended.primos.min === 'number') {
              this.filters.primos = { min: recommended.primos.min, max: recommended.primos.max };
          }
          if (Array.isArray(recommended.consecutivos)) {
              this.filters.consecutivos = recommended.consecutivos;
          }
          if (recommended.distancia && typeof recommended.distancia.min === 'number') {
              this.filters.distancia = { min: recommended.distancia.min, max: recommended.distancia.max };
          }
          if (Array.isArray(recommended.agrupDecenas)) {
              this.filters.agrupDecenas = recommended.agrupDecenas;
          }
          if (recommended.sumaDigitos && typeof recommended.sumaDigitos.min === 'number') {
              this.filters.sumaDigitos = { min: recommended.sumaDigitos.min, max: recommended.sumaDigitos.max };
          }
          if (recommended.desviacion && typeof recommended.desviacion.min === 'number') {
              this.filters.desviacion = { min: recommended.desviacion.min, max: recommended.desviacion.max };
          }
          if (recommended.entropyTerminaciones && typeof recommended.entropyTerminaciones.min === 'number') {
              this.filters.entropyTerminaciones = { min: recommended.entropyTerminaciones.min, max: recommended.entropyTerminaciones.max };
          }
          if (recommended.entropyIntervalos && typeof recommended.entropyIntervalos.min === 'number') {
              this.filters.entropyIntervalos = { min: recommended.entropyIntervalos.min, max: recommended.entropyIntervalos.max };
          }

          // Filtros de estrellas si corresponden
          if (this.currentGame.maxStars > 0) {
              if (recommended.starSum && typeof recommended.starSum.min === 'number') {
                  this.filters.starSum = { min: recommended.starSum.min, max: recommended.starSum.max };
              }
              if (Array.isArray(recommended.starParImpar)) {
                  this.filters.starParImpar = recommended.starParImpar;
              }
              if (Array.isArray(recommended.starBajosAltos)) {
                  this.filters.starBajosAltos = recommended.starBajosAltos;
              }
              if (recommended.starSumaDigitos && typeof recommended.starSumaDigitos.min === 'number') {
                  this.filters.starSumaDigitos = { min: recommended.starSumaDigitos.min, max: recommended.starSumaDigitos.max };
              }
              if (recommended.starPrimos && typeof recommended.starPrimos.min === 'number') {
                  this.filters.starPrimos = { min: recommended.starPrimos.min, max: recommended.starPrimos.max };
              }
              if (Array.isArray(recommended.starConsecutivos)) {
                  this.filters.starConsecutivos = recommended.starConsecutivos;
              }
              if (recommended.starDistancia && typeof recommended.starDistancia.min === 'number') {
                  this.filters.starDistancia = { min: recommended.starDistancia.min, max: recommended.starDistancia.max };
              }
          }

          if (typeof recommended.useMarkov === 'boolean') {
              this.filters.useMarkov = recommended.useMarkov;
          }
          if (typeof recommended.useNash === 'boolean') {
              this.filters.useNash = recommended.useNash;
          }
          if (typeof recommended.useRegression === 'boolean') {
              this.filters.useRegression = recommended.useRegression;
          }

          // 4. Sincronizar el estado en el DOM de filtros y grids del tablero
          this.updateUIFromFilterState();
          this.updateGridNumberStates();

          // 5. Mostrar razonamiento de forma premium en el panel
          const block = document.getElementById('aiReasoningBlock');
          const text = document.getElementById('aiReasoningText');
          if (block && text && recommended.reasoning) {
              text.textContent = recommended.reasoning;
              block.style.display = 'block';
          }

          this.saveState();
          this.showToast(`✨ Filtros optimizados por IA aplicados con éxito.`, 'success');

      } catch (error: any) {
          console.error("Error aplicando filtros de IA:", error);
          this.showToast(`Error de IA: ${error.message || 'No se pudo conectar con Gemini'}`, 'error');
      }
  }

  saveFilterPreset() {
      // Keep for backward compatibility or remove if not used
      this.openSaveFilterModal();
  }

  loadState() {
      try {
          const savedStateJSON = localStorage.getItem(DataLotto49Advanced.APP_STATE_KEY);
          if (savedStateJSON) {
              const savedState = JSON.parse(savedStateJSON);
              this.savedTickets = savedState.savedTickets || [];
              // Migrate any old saved tickets gameId from 'lotto649' or missing to 'bonoloto'
              this.savedTickets.forEach((t: any) => {
                  if (!t.gameId || t.gameId === 'lotto649') {
                      t.gameId = 'bonoloto';
                  }
              });
              
              if (savedState.gameFilters) {
                  this.gameFilters = savedState.gameFilters;
                  // Migrate lotto649 saved filters to bonoloto / primitiva
                  if (this.gameFilters['lotto649']) {
                      if (!this.gameFilters['bonoloto']) {
                          this.gameFilters['bonoloto'] = JSON.parse(JSON.stringify(this.gameFilters['lotto649']));
                      }
                      if (!this.gameFilters['primitiva']) {
                          this.gameFilters['primitiva'] = JSON.parse(JSON.stringify(this.gameFilters['lotto649']));
                      }
                      delete this.gameFilters['lotto649'];
                  }
                  this.filters = this.normalizeFilters(this.gameFilters[this.currentGame.id], this.currentGame.id);
              } else if (savedState.filters) {
                  // Migration from old single filter structure
                  this.filters = this.normalizeFilters(savedState.filters, this.currentGame.id);
                  this.gameFilters[this.currentGame.id] = this.filters;
              }

              // Apply normalizeFilters to all gameFilters so switching lists are normalized too
              if (this.gameFilters) {
                  Object.keys(this.gameFilters).forEach(gid => {
                      this.gameFilters[gid] = this.normalizeFilters(this.gameFilters[gid], gid);
                  });
              }

              if (!this.filters.ai) { // Ensure ai config exists for older states
                this.filters.ai = { markovDepth: 5, nashWeight: 1, regressionBonus: 3 };
              }
              this.historicalData = (savedState.historicalData || []).map((d: any) => ({...d, date: new Date(d.date)}));
              this.dataType = savedState.dataType || 'none';
              this.dataLoaded = savedState.dataLoaded || false;
              this.favoriteNumbers = new Set(savedState.favoriteNumbers || []);
              this.favoriteGames = new Set(savedState.favoriteGames || []);
              if (savedState.customGameUrls) {
                  this.customGameUrls = { ...this.customGameUrls, ...savedState.customGameUrls };
              }
              this.filterPresets = savedState.filterPresets || [];
              console.log("Estado de la aplicación cargado desde localStorage.");
          }
          
          // Load filter preset if exists (overriding last session filters if necessary, acting as user default)
          const savedFilters = localStorage.getItem(DataLotto49Advanced.FILTER_PRESET_KEY);
          if (savedFilters) {
              this.filters = this.normalizeFilters({ ...this.filters, ...JSON.parse(savedFilters) }, this.currentGame.id);
              console.log("Filtros predeterminados cargados.");
          }

      } catch (error) {
          console.error("Error cargando el estado:", error);
          this.showToast('No se pudo cargar el estado anterior', 'warning');
      }
  }

  updateUIFromFilterState() {
    document.querySelectorAll('.filter-title .filter-activity-badge').forEach(el => el.remove());
    // Inputs de rango
    const setVal = (id: string, value: number | string) => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el) el.value = String(value);
    };
    
    const setRangeVal = (id: string, value: number) => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el) el.value = String(value);
      const displayEl = document.getElementById(`${id}Value`);
      if (displayEl) displayEl.textContent = String(value);
    }

    setVal('sumMin', this.filters.sum.min);
    setVal('sumMax', this.filters.sum.max);
    setVal('primosMin', this.filters.primos.min);
    setVal('primosMax', this.filters.primos.max);
    setVal('distanciaMin', this.filters.distancia.min);
    setVal('distanciaMax', this.filters.distancia.max);
    setVal('sumaDigitosMin', this.filters.sumaDigitos.min);
    setVal('sumaDigitosMax', this.filters.sumaDigitos.max);
    setVal('desviacionMin', this.filters.desviacion.min);
    setVal('desviacionMax', this.filters.desviacion.max);
    setVal('entropyTerminacionesMin', this.filters.entropyTerminaciones.min);
    setVal('entropyTerminacionesMax', this.filters.entropyTerminaciones.max);
    setVal('entropyIntervalosMin', this.filters.entropyIntervalos.min);
    setVal('entropyIntervalosMax', this.filters.entropyIntervalos.max);
    
    // Star ranges
    setVal('starSumMin', this.filters.starSum.min);
    setVal('starSumMax', this.filters.starSum.max);
    setVal('starSumaDigitosMin', this.filters.starSumaDigitos.min);
    setVal('starSumaDigitosMax', this.filters.starSumaDigitos.max);
    setVal('starPrimosMin', this.filters.starPrimos.min);
    setVal('starPrimosMax', this.filters.starPrimos.max);
    setVal('starDistanciaMin', this.filters.starDistancia.min);
    setVal('starDistanciaMax', this.filters.starDistancia.max);

    setRangeVal('markovDepth', this.filters.ai.markovDepth);
    setRangeVal('nashWeight', this.filters.ai.nashWeight);
    setRangeVal('regressionBonus', this.filters.ai.regressionBonus);


    // Chips
    const updateChips = (selector: string, activeValues: (string | number)[]) => {
      document.querySelectorAll(selector).forEach(chip => {
        const chipEl = chip as HTMLElement;
        const value = chipEl.dataset.value!;
        if (activeValues.map(String).includes(value)) {
          chipEl.classList.add('active');
        } else {
          chipEl.classList.remove('active');
        }
      });
    };

    updateChips('#terminacionesOptions .filter-chip', this.filters.terminaciones);
    updateChips('#terminacionesDistintasOptions .filter-chip', this.filters.terminacionesDistintas);
    updateChips('#parImparOptions .filter-chip', this.filters.parImpar);
    updateChips('#bajosAltosOptions .filter-chip', this.filters.bajosAltos);
    updateChips('#consecutivosOptions .filter-chip', this.filters.consecutivos);
    updateChips('#agrupDecenasOptions .filter-chip', this.filters.agrupDecenas);
    
    // Star chips
    updateChips('#starParImparOptions .filter-chip', this.filters.starParImpar);
    updateChips('#starBajosAltosOptions .filter-chip', this.filters.starBajosAltos);
    updateChips('#starConsecutivosOptions .filter-chip', this.filters.starConsecutivos);
    
    // Chips geométricos (caso especial con iconos 🚫/👍)
    document.querySelectorAll('#geometricOptions .filter-chip').forEach(chip => {
        const chipEl = chip as HTMLElement;
        const value = chipEl.dataset.value!;
        chipEl.classList.remove('active');
        if (this.filters.geometric.exclude.includes(value) || this.filters.geometric.favor.includes(value)) {
            chipEl.classList.add('active');
        }
    });

    // Switches
    const setChecked = (id: string, isChecked: boolean) => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el) el.checked = isChecked;
    };
    
    setChecked('useMarkovSwitch', this.filters.useMarkov);
    setChecked('useNashSwitch', this.filters.useNash);
    setChecked('useRegressionSwitch', this.filters.useRegression);
  }

  // ===== DATOS HISTÓRICOS (Sin cambios) =====
  initializeHistoricalData() {
    if (!this.dataLoaded) {
      this.simulateHistoricalData(500);
    }
  }
  simulateHistoricalData(numDraws = 500) {
    this.showFilterSpinner();
    this.historicalData = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - numDraws * 3.5);

    for(let i = 0; i < numDraws; i++) {
      const drawDate = new Date(baseDate);
      drawDate.setDate(drawDate.getDate() + (i * 3.5));
      const { numbers, stars, complementario, reintegro } = this.generateRealisticDraw();
      this.historicalData.push({
        id: i + 1,
        date: drawDate,
        numbers: numbers.sort((a, b) => a - b),
        stars: stars ? stars.sort((a, b) => a - b) : undefined,
        complementario: complementario,
        reintegro: reintegro,
        sum: numbers.reduce((a, b) => a + b, 0)
      });
    }
    
    this.dataType = 'simulated';
    this.dataLoaded = true;
    this.updateDataAnalysis();
    this.analyzeNumbers();
    this.updateGridNumberStates();
    this.updateBigDataPanel(); // NEW
    this.saveState();
    this.showToast('✅ Datos simulados generados correctamente', 'success');
    this.hideFilterSpinner();
  }
  generateRealisticDraw(): { numbers: number[], stars?: number[], complementario?: number, reintegro?: number } {
    const numbers = new Set<number>();
    while(numbers.size < this.currentGame.maxNumbers) {
        const num = Math.floor(Math.random() * this.currentGame.numberRange) + 1;
        if(!numbers.has(num)) {
            numbers.add(num);
        }
    }

    let stars: number[] | undefined = undefined;
    if (this.currentGame.maxStars > 0) {
        const starSet = new Set<number>();
        const isGordo = this.currentGame.id === 'gordo';
        while(starSet.size < this.currentGame.maxStars) {
            const range = this.currentGame.starRange;
            const star = isGordo ? Math.floor(Math.random() * range) : Math.floor(Math.random() * range) + 1;
            if(!starSet.has(star)) {
                starSet.add(star);
            }
        }
        stars = Array.from(starSet);
    }

    let complementario: number | undefined = undefined;
    let reintegro: number | undefined = undefined;
    if (this.currentGame.id !== 'euromillones' && this.currentGame.id !== 'eurodreams' && this.currentGame.id !== 'gordo') {
        // Complementario: un número del 1 al 49 que no esté en los principales
        let comp;
        do {
            comp = Math.floor(Math.random() * 49) + 1;
        } while (numbers.has(comp));
        complementario = comp;
        // Reintegro: un número del 0 al 9
        reintegro = Math.floor(Math.random() * 10);
    }

    return { numbers: Array.from(numbers), stars, complementario, reintegro };
  }
  async loadRealData(files: FileList) {
    this.showFilterSpinner();
    try {
      this.historicalData = [];
      let totalDraws = 0;
      
      for (const file of Array.from(files)) {
        const data = await this.loadDataFile(file);
        this.historicalData.push(...data);
        totalDraws += data.length;
      }
      
      this.historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());
      this.historicalData.forEach((draw, index) => {
        draw.id = index + 1;
      });
      
      this.dataType = 'real';
      this.dataLoaded = true;
      this.updateDataAnalysis();
      this.analyzeNumbers();
      this.updateGridNumberStates();
      this.updateBigDataPanel(); // NEW
      this.saveState();
      
      this.showToast(`✅ Datos reales cargados: ${totalDraws} sorteos`, 'success');
      this.autoValidateSavedTickets();
      
    } catch (error: any) {
      this.showToast(`Error cargando datos: ${error.message}`, 'error');
    } finally {
        this.hideFilterSpinner();
    }
  }
  async loadDataFromUrl() {
    this.renderGameSelectionList();
    this.toggleModal('gameSelectionModal', true);
  }

  renderGameSelectionList() {
    const listContainer = document.getElementById('gameSelectionList');
    if (!listContainer) return;

    let GAMES_LIST = [];
    if (this.currentGame.id === 'bonoloto') {
        GAMES_LIST = [
            { id: 'bonoloto', name: 'Bonoloto España', flag: '🇪🇸' }
        ];
    } else if (this.currentGame.id === 'primitiva') {
        GAMES_LIST = [
            { id: 'primitiva', name: 'Primitiva España', flag: '🇪🇸' }
        ];
    } else if (this.currentGame.id === 'euromillones') {
        GAMES_LIST = [
            { id: 'euromillones', name: 'Euromillones', flag: '🇪🇺' }
        ];
    } else if (this.currentGame.id === 'eurodreams') {
        GAMES_LIST = [
            { id: 'eurodreams', name: 'EuroDreams', flag: '🌙' }
        ];
    } else if (this.currentGame.id === 'gordo') {
        GAMES_LIST = [
            { id: 'gordo', name: 'El Gordo', flag: '🏆' }
        ];
    }

    // Sort: Favorites first, then keep requested order
    const sortedGames = [...GAMES_LIST].sort((a, b) => {
        const aFav = this.favoriteGames.has(a.id);
        const bFav = this.favoriteGames.has(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return GAMES_LIST.findIndex(x => x.id === a.id) - GAMES_LIST.findIndex(x => x.id === b.id);
    });

    listContainer.innerHTML = '';
    sortedGames.forEach(game => {
        const isFav = this.favoriteGames.has(game.id);
        const item = document.createElement('div');
        item.className = 'game-select-item';
        item.style.cssText = 'display: flex; align-items: center; gap: 10px; width: 100%;';
        
        const btn = document.createElement('button');
        btn.className = 'game-select-btn';
        btn.style.cssText = 'flex: 1; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; text-align: left; font-size: 1rem; display: flex; align-items: center; gap: 10px; transition: all 0.2s;';
        btn.innerHTML = `<span>${game.flag}</span> <strong>${game.name}</strong>`;
        btn.onclick = () => this.loadSpecificGame(game.id as any);

        const favBtn = document.createElement('button');
        favBtn.className = `game-fav-btn ${isFav ? 'active' : ''}`;
        favBtn.innerHTML = isFav ? '⭐' : '☆';
        favBtn.style.cssText = 'background: none; border: none; font-size: 1.5rem; cursor: pointer; padding: 5px;';
        favBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.favoriteGames.has(game.id)) {
                this.favoriteGames.delete(game.id);
            } else {
                this.favoriteGames.add(game.id);
            }
            this.saveState();
            this.renderGameSelectionList();
            this.updateSidebarGameOrder();
        };

        item.appendChild(btn);
        item.appendChild(favBtn);
        listContainer.appendChild(item);
    });
  }

  renderPlayOnlineList() {
    const listContainer = document.getElementById('playOnlineList');
    if (!listContainer) return;

    const GAMES_LIST = [
        { id: 'bonoloto', name: 'Bonoloto España', flag: '🇪🇸' },
        { id: 'primitiva', name: 'Primitiva España', flag: '🇪🇸' },
        { id: 'gordo', name: 'El Gordo', flag: '🏆' },
        { id: 'euromillones', name: 'Euromillones', flag: '🇪🇺' },
        { id: 'eurodreams', name: 'EuroDreams', flag: '🌙' }
    ];

    const sortedGames = [...GAMES_LIST].sort((a, b) => {
        const aFav = this.favoriteGames.has(a.id);
        const bFav = this.favoriteGames.has(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return GAMES_LIST.findIndex(x => x.id === a.id) - GAMES_LIST.findIndex(x => x.id === b.id);
    });

    listContainer.innerHTML = '';
    sortedGames.forEach(game => {
        const isFav = this.favoriteGames.has(game.id);
        const item = document.createElement('div');
        item.className = 'game-select-item';
        item.style.cssText = 'display: flex; align-items: center; gap: 10px; width: 100%;';
        
        const btn = document.createElement('button');
        btn.className = 'modal-btn confirm';
        btn.style.cssText = 'flex: 1; padding: 15px; text-align: left; display: flex; align-items: center; gap: 10px;';
        btn.innerHTML = `<span>${game.flag}</span> ${game.name}`;
        btn.onclick = () => this.confirmPlayOnline(game.id as any);

        const favBtn = document.createElement('button');
        favBtn.className = `game-fav-btn ${isFav ? 'active' : ''}`;
        favBtn.innerHTML = isFav ? '⭐' : '☆';
        favBtn.style.cssText = 'background: none; border: none; font-size: 1.5rem; cursor: pointer; padding: 5px;';
        favBtn.onclick = (e) => {
            e.stopPropagation();
            if (this.favoriteGames.has(game.id)) {
                this.favoriteGames.delete(game.id);
            } else {
                this.favoriteGames.add(game.id);
            }
            this.saveState();
            this.renderPlayOnlineList();
            this.updateSidebarGameOrder();
        };

        item.appendChild(btn);
        item.appendChild(favBtn);
        listContainer.appendChild(item);
    });
  }

  updateSidebarGameOrder() {
    const sidebarUL = document.querySelector('#sidebar .sidebar-links');
    if (!sidebarUL) return;

    const gameIds = ['bonoloto', 'primitiva', 'gordo', 'euromillones', 'eurodreams'];
    const gameElements: { [key: string]: HTMLElement } = {};
    
    gameIds.forEach(id => {
      const el = document.getElementById(`game-${id}`);
      if (el) {
        gameElements[id] = el;
        el.remove();
      }
    });

    // Sort according to favorites, then original order
    const sortedGameIds = [...gameIds].sort((a, b) => {
      const aFav = this.favoriteGames.has(a);
      const bFav = this.favoriteGames.has(b);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return gameIds.indexOf(a) - gameIds.indexOf(b);
    });

    // Find the divider or insert at beginning of UL
    const divider = sidebarUL.querySelector('.divider');
    sortedGameIds.forEach(id => {
      const el = gameElements[id];
      if (el) {
        if (divider) {
          sidebarUL.insertBefore(el, divider);
        } else {
          sidebarUL.appendChild(el);
        }
      }
    });
  }

  generateSyntheticCSV(gameKey: 'bonoloto' | 'primitiva' | 'euromillones' | 'eurodreams' | 'gordo'): string {
    const game = GAMES[gameKey];
    const maxNumbers = game.maxNumbers;
    const maxStars = game.maxStars || 0;
    const numberRange = game.numberRange;
    const starRange = game.starRange || 0;
    
    let header = 'Fecha,N1,N2,N3,N4,N5';
    if (maxNumbers === 6) header += ',N6';
    if (maxStars === 1) header += ',Estrella 1';
    if (maxStars === 2) header += ',Estrella 1,Estrella 2';
    
    let csv = header + '\n';
    
    // Generar 100 sorteos históricos realistas (espaciados semanalmente)
    const now = new Date();
    for (let i = 0; i < 100; i++) {
      const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const dateStr = `${day}/${month}/${year}`;
      
      // Combinación de números aleatoria sin repetición
      const nums: number[] = [];
      const numPool = Array.from({ length: numberRange }, (_, idx) => idx + 1);
      for (let n = 0; n < maxNumbers; n++) {
        const idx = Math.floor(Math.random() * numPool.length);
        nums.push(numPool.splice(idx, 1)[0]);
      }
      nums.sort((a, b) => a - b);
      
      // Combinación de estrellas aleatoria sin repetición
      const stars: number[] = [];
      const starPool = Array.from({ length: starRange }, (_, idx) => idx + 1);
      for (let s = 0; s < maxStars; s++) {
        const idx = Math.floor(Math.random() * starPool.length);
        stars.push(starPool.splice(idx, 1)[0]);
      }
      stars.sort((a, b) => a - b);
      
      let row = dateStr + ',' + nums.join(',');
      if (stars.length > 0) {
        row += ',' + stars.join(',');
      }
      csv += row + '\n';
    }
    return csv;
  }

  async loadSpecificGame(gameKey: 'bonoloto' | 'primitiva' | 'euromillones' | 'eurodreams' | 'gordo') {
    const GAMES_CONFIG: { [key: string]: string } = {
        bonoloto: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQoIJeLcb9AcK8E6o_aw41gseUzNHl3518Etam-O60x-I9m8Ta6zMcg5TwZCznXzmWzxU18i-bYX81D/pub?output=csv",
        primitiva: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSmhAHqGSrFFNqbugQz_CK9X-pT2diofnrYy_Wus7_MyPlDjJVk-8n1MGIat9phYSzeY0vz7kKjw-tC/pub?output=csv",
        euromillones: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT9LdJPVydRU1ohhiCuUeVb0nFTnFdZG_4JJhD8K7dJzrhHVOLUNB1SDF4TkbkqXSqrF_LGbhYQGgl6/pub?output=csv",
        eurodreams: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR9UhEkG1_cHAMDvBsmhkzqjpismGFGhouomp9PV3QN4YfIAsdvQF4A5d1iOddnjbz8CKkN3xFC-jjf/pub?output=csv",
        gordo: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS_2jIvMo4_HmGowBdT0oRAB0fQOCW28JDtgxc_Rm_u9YBUTx1_D7pQ3-NuMh7KvuCJNpoP7bzgAzPc/pub?output=csv"
    };

    const url = GAMES_CONFIG[gameKey];
    this.toggleModal('gameSelectionModal', false);
    this.showFilterSpinner();

    try {
      const gameName = GAMES[gameKey]?.name || gameKey;
      this.showLoading(`Cargando base de datos de ${gameName}...`);
      let content = '';
      let isOffline = false;

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        content = await response.text();
        localStorage.setItem(`datalotto_csv_cache_${gameKey}`, content);
      } catch (fetchError: any) {
        console.warn(`Error de descarga para ${gameKey}, buscando caché...`, fetchError);
        const cached = localStorage.getItem(`datalotto_csv_cache_${gameKey}`);
        if (cached) {
          content = cached;
          isOffline = true;
          this.showToast(`Modo Sin Conexión: Usando base de datos local guardada en caché.`, 'warning');
        } else {
          content = this.generateSyntheticCSV(gameKey);
          isOffline = true;
          this.showToast(`Sin caché ni red: Generando base histórica secuencial simulada.`, 'warning');
        }
      }

      const data = this.parseCSVData(content);
      
      this.historicalData = data;
      this.dataType = gameKey;
      this.dataLoaded = true;
      this.updateDataAnalysis();
      this.analyzeNumbers();
      this.updateGridNumberStates();
      this.updateBigDataPanel();
      this.saveState();
      
      const successMsg = isOffline 
          ? `⚠️ Base de Datos de ${gameKey.toUpperCase()} cargada sin conexión: ${data.length} sorteos`
          : `✅ Base de Datos de ${gameKey.toUpperCase()} cargada: ${data.length} sorteos`;
          
      this.showToast(successMsg, isOffline ? 'warning' : 'success');
      this.autoValidateSavedTickets();
    } catch (error: any) {
      this.showToast(`Error de integridad de base de datos: ${error.message}`, 'error');
    } finally {
        this.hideLoading();
        this.hideFilterSpinner();
    }
  }
  async loadDataFile(file: File): Promise<Draw[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target!.result as string;
          resolve(this.parseCSVData(content));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsText(file);
    });
  }
  parseCSVData(content: string): Draw[] {
    const lines = content.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        return [];
    }

    const firstLine = lines.shift()!;
    const header = firstLine.toLowerCase().split(/[,;\t\s]+/).map(h => h.trim());

    const isHeader = header.some(h => isNaN(parseInt(h)) && isNaN(new Date(h).getTime()));
    
    if (!isHeader) {
        lines.unshift(firstLine); 
    }
    
    let dateIndex = -1;
    let numberIndices: number[] = [];
    let starIndices: number[] = [];
    let complementarioIndex = -1;
    let reintegroIndex = -1;

    const maxNumbers = this.currentGame.maxNumbers;
    const maxStars = this.currentGame.maxStars;
    const numberRange = this.currentGame.numberRange;
    const starRange = this.currentGame.starRange;

    if (isHeader) {
        const dateKeywords = ['fecha', 'date'];
        dateIndex = header.findIndex(h => dateKeywords.some(k => h.includes(k)));

        const numberHeaderCandidates: {index: number, name: string}[] = [];
        const starHeaderCandidates: {index: number, name: string}[] = [];
        
        header.forEach((h, i) => {
            if (/^(n|bola|num|number|c)[\s_-]*\d+$/i.test(h)) {
                numberHeaderCandidates.push({index: i, name: h});
            } else if (/^(s|estrella|star|e)[\s_-]*\d+$/i.test(h)) {
                starHeaderCandidates.push({index: i, name: h});
            } else if (h.includes('complementario') || h === 'c') {
                complementarioIndex = i;
            } else if (h.includes('reintegro') || h === 'r') {
                reintegroIndex = i;
            }
        });
        
        if (numberHeaderCandidates.length >= maxNumbers) {
            numberHeaderCandidates.sort((a, b) => {
                const matchA = a.name.match(/\d+$/);
                const matchB = b.name.match(/\d+$/);
                const numA = matchA ? parseInt(matchA[0]) : 0;
                const numB = matchB ? parseInt(matchB[0]) : 0;
                return numA - numB;
            });
            numberIndices = numberHeaderCandidates.map(c => c.index).slice(0, maxNumbers);
        }

        if (maxStars > 0 && starHeaderCandidates.length >= maxStars) {
            starHeaderCandidates.sort((a, b) => {
                const matchA = a.name.match(/\d+$/);
                const matchB = b.name.match(/\d+$/);
                const numA = matchA ? parseInt(matchA[0]) : 0;
                const numB = matchB ? parseInt(matchB[0]) : 0;
                return numA - numB;
            });
            starIndices = starHeaderCandidates.map(c => c.index).slice(0, maxStars);
        }
    }

    if (numberIndices.length < maxNumbers) {
        return lines.map((line, i) => {
            const parts = line.split(/[,;\t\s]+/);
            let date: Date | null = null;
            if (parts.length > 0) {
                const d = new Date(parts[0]);
                if (!isNaN(d.getTime()) && (parts[0].includes('-') || parts[0].includes('/'))) {
                   date = d;
                }
            }
            
            const allNumbers = parts.map(n => parseInt(n.trim())).filter(n => !isNaN(n));
            const numbers = allNumbers.filter(n => n >= 1 && n <= numberRange).slice(0, maxNumbers);
            
            if (numbers.length < maxNumbers) {
                return null;
            }

            let stars: number[] | undefined = undefined;
            let complementario: number | undefined = undefined;
            let reintegro: number | undefined = undefined;

            if (maxStars > 0) {
                // Try to find stars: they are usually after the main numbers
                // We take the next available numbers that fit the star range
                const remainingNumbers = allNumbers.filter((_, idx) => !numbers.includes(allNumbers[idx]));
                stars = remainingNumbers.filter(n => n >= 1 && n <= starRange).slice(0, maxStars);
            } else if (this.currentGame.id !== 'euromillones') {
                // For 6/49, try to find complementario and reintegro
                const remainingNumbers = allNumbers.filter((_, idx) => !numbers.includes(allNumbers[idx]));
                if (remainingNumbers.length >= 1) {
                    complementario = remainingNumbers[0];
                }
                if (remainingNumbers.length >= 2) {
                    reintegro = remainingNumbers[1];
                }
            }

            return {
                id: i + 1,
                date: date || new Date(Date.now() - (lines.length - i) * 3.5 * 24 * 60 * 60 * 1000),
                numbers: numbers.sort((a, b) => a - b),
                stars: stars,
                complementario,
                reintegro,
                sum: numbers.reduce((a, b) => a + b, 0)
            };
        }).filter(Boolean) as Draw[];
    }
    
    return lines.map((line, i) => {
        try {
            const parts = line.split(/[,;\t\s]+/);
            if (parts.length <= Math.max(...numberIndices, dateIndex)) {
                return null;
            }
            const numbers = numberIndices.map(index => parseInt(parts[index].trim()));
            if (numbers.some(isNaN)) return null;
            
            let stars: number[] | undefined = undefined;
            if (maxStars > 0 && starIndices.length === maxStars) {
                stars = starIndices.map(index => parseInt(parts[index].trim()));
                if (stars.some(isNaN)) stars = undefined;
            }

            let complementario: number | undefined = undefined;
            if (complementarioIndex > -1 && parts[complementarioIndex]) {
                complementario = parseInt(parts[complementarioIndex].trim());
                if (isNaN(complementario)) complementario = undefined;
            }

            let reintegro: number | undefined = undefined;
            if (reintegroIndex > -1 && parts[reintegroIndex]) {
                reintegro = parseInt(parts[reintegroIndex].trim());
                if (isNaN(reintegro)) reintegro = undefined;
            }

            let date: Date;
            if (dateIndex > -1 && parts[dateIndex]) {
                const parsedDate = new Date(parts[dateIndex]);
                date = isNaN(parsedDate.getTime()) ? new Date(Date.now() - (lines.length - i) * 3.5 * 24 * 60 * 60 * 1000) : parsedDate;
            } else {
                date = new Date(Date.now() - (lines.length - i) * 3.5 * 24 * 60 * 60 * 1000);
            }
            return {
                id: i + 1,
                date: date,
                numbers: numbers.sort((a, b) => a - b),
                stars: stars ? stars.sort((a, b) => a - b) : undefined,
                complementario,
                reintegro,
                sum: numbers.reduce((a, b) => a + b, 0)
            };
        } catch (error: any) {
            return null;
        }
    }).filter(Boolean) as Draw[];
  }
  updateDataAnalysis() {
    const dataInfo = document.getElementById('dataInfo');
    const dataStatsGrid = document.getElementById('dataStatsGrid');
    if (!dataInfo || !dataStatsGrid) return;
    
    if (!this.dataLoaded || this.historicalData.length === 0) {
      dataInfo.textContent = 'No hay datos cargados. Carga una base de datos CSV/DB o simula datos históricos.';
      dataInfo.className = 'data-info';
      dataStatsGrid.style.display = 'none';
      this.renderFrequencyChart(); // Clear chart
      return;
    }

    // Frequencies for Numbers
    const frequencies: { [key: number]: number } = {};
    for (let i = 1; i <= this.currentGame.numberRange; i++) frequencies[i] = 0;
    this.historicalData.forEach(draw => draw.numbers.forEach(num => {
        if (frequencies[num] !== undefined) frequencies[num]++;
    }));
    const sortedFreq = Object.entries(frequencies).sort((a, b) => b[1] - a[1]);

    // Frequencies for Stars
    let starStatsText = '';
    const starFrequencies: { [key: number]: number } = {};
    if (this.currentGame.maxStars > 0) {
        for (let i = 1; i <= this.currentGame.starRange; i++) starFrequencies[i] = 0;
        this.historicalData.forEach(draw => {
            if (draw.stars) {
                draw.stars.forEach(star => {
                    if (starFrequencies[star] !== undefined) starFrequencies[star]++;
                });
            }
        });
        const sortedStarFreq = Object.entries(starFrequencies).sort((a, b) => b[1] - a[1]);
        starStatsText = `<br><span style="color: #d97706; font-size: 0.8rem;">⭐ Estrellas top: ${sortedStarFreq.slice(0, 2).map(([num]) => num).join(', ')}</span>`;
    }

    dataInfo.innerHTML = `📊 ${this.historicalData.length} sorteos cargados (${this.dataType.toUpperCase()})${starStatsText}`;
    dataInfo.className = 'data-info has-data';
    
    const safeSetText = (id: string, text: string | number) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(text);
    };
    
    safeSetText('totalDraws', this.historicalData.length);
    safeSetText('dataType', this.dataType.toUpperCase());
    safeSetText('mostFrequent', sortedFreq.slice(0, 3).map(([num]) => num).join(', '));
    safeSetText('leastFrequent', sortedFreq.slice(-3).map(([num]) => num).join(', '));
    
    const chiSquareEl = document.getElementById('chiSquare');
    const biasEl = document.getElementById('biasDetected');

    if (this.historicalData.length >= 50 && chiSquareEl && biasEl) {
        // Chi-Square for Numbers
        const expectedFrequency = (this.historicalData.length * this.currentGame.maxNumbers) / this.currentGame.numberRange;
        let chiSquareStat = 0;
        for (let i = 1; i <= this.currentGame.numberRange; i++) {
            chiSquareStat += Math.pow((frequencies[i] || 0) - expectedFrequency, 2) / expectedFrequency;
        }

        // Chi-Square for Stars (if applicable)
        if (this.currentGame.maxStars > 0) {
            const expectedStarFreq = (this.historicalData.length * this.currentGame.maxStars) / this.currentGame.starRange;
            for (let i = 1; i <= this.currentGame.starRange; i++) {
                chiSquareStat += Math.pow((starFrequencies[i] || 0) - expectedStarFreq, 2) / expectedStarFreq;
            }
        }

        // Adjust critical value based on degrees of freedom (approximate)
        // df = (numberRange - 1) + (starRange - 1 if applicable)
        const df = (this.currentGame.numberRange - 1) + (this.currentGame.maxStars > 0 ? (this.currentGame.starRange - 1) : 0);
        // Critical value for p=0.05, df=48 is 65.17. For df=48+11=59 is ~77.93
        const criticalValue = df > 50 ? 79.08 : 65.17; 
        
        const biasDetected = chiSquareStat > criticalValue;
        
        chiSquareEl.textContent = chiSquareStat.toFixed(2);
        biasEl.textContent = biasDetected ? 'Sí (Significativo al 95%)' : 'No (Distribución Normal)';
        biasEl.classList.toggle('invalid', biasDetected);
        biasEl.classList.toggle('valid', !biasDetected);
    } else if(chiSquareEl && biasEl) {
        chiSquareEl.textContent = 'N/A';
        biasEl.textContent = 'Datos insuficientes';
        biasEl.classList.remove('valid', 'invalid');
    }
    
    dataStatsGrid.style.display = 'grid';
    this.renderFrequencyChart();
    this.updateBigDataPanel(); // Refresh panel on data load
    this.updateBacktestUI();
  }

  // ===== ANÁLISIS DE NÚMEROS (Actualizado) =====
  analyzeNumbers() {
    // Reset stats
    this.numberStats = {};
    for(let i = 1; i <= this.currentGame.numberRange; i++) this.numberStats[i] = { frequency: 0, score: 0, lastSeen: 0 };
    
    this.starStats = {};
    if (this.currentGame.maxStars > 0) {
        for(let i = 1; i <= this.currentGame.starRange; i++) this.starStats[i] = { frequency: 0, score: 0, lastSeen: 0 };
    }

    // Recorrer toda la historia
    this.historicalData.forEach(draw => {
        // Basic Stats Numbers
        draw.numbers.forEach(num => {
            if (this.numberStats[num]) this.numberStats[num].lastSeen = draw.id;
        });
        // Basic Stats Stars
        if (draw.stars) {
            draw.stars.forEach(star => {
                if (this.starStats[star]) this.starStats[star].lastSeen = draw.id;
            });
        }
    });
    
    // Recorrer el periodo de análisis para la frecuencia (calientes/fríos)
    const analysisData = this.historicalData.slice(-this.analysisPeriod);
    if (analysisData.length === 0) {
        this.classifyNumbers(); // Limpiará los sets si no hay datos
        return;
    }
    analysisData.forEach(draw => {
        draw.numbers.forEach(num => {
            if (this.numberStats[num]) this.numberStats[num].frequency++;
        });
        if (draw.stars) {
            draw.stars.forEach(star => {
                if (this.starStats[star]) this.starStats[star].frequency++;
            });
        }
    });
    
    this.classifyNumbers();
    this.analyzeLastDrawTrend();
  }

  analyzeLastDrawTrend() {
    if (!this.historicalData || this.historicalData.length === 0 || !this.drawTrendPanel) return;

    const lastDraw = this.historicalData[this.historicalData.length - 1];
    const numbers = lastDraw.numbers;
    const stars = lastDraw.stars || [];
    const maxNumbers = this.currentGame.maxNumbers;
    const maxStars = this.currentGame.maxStars;
    
    let hotCount = 0;
    let coldCount = 0;
    let neutralCount = 0;

    numbers.forEach(n => {
      if (this.hotNumbers.has(n)) hotCount++;
      else if (this.coldNumbers.has(n)) coldCount++;
      else neutralCount++;
    });

    let hotStarCount = 0;
    let coldStarCount = 0;
    let neutralStarCount = 0;

    stars.forEach(s => {
        if (this.hotStars.has(s)) hotStarCount++;
        else if (this.coldStars.has(s)) coldStarCount++;
        else neutralStarCount++;
    });

    this.drawTrendPanel.style.display = 'block';

    let trend = "";
    let recommendation = "";
    
    // Default suggestions for numbers (balanced)
    let suggestedHot = Math.floor(maxNumbers * 0.4);
    let suggestedCold = Math.floor(maxNumbers * 0.2);
    let suggestedNeutral = maxNumbers - suggestedHot - suggestedCold;

    // Lógica de "Regresión a la Media" para Números
    const hotThreshold = Math.ceil(maxNumbers * 0.6); // 4 for 6, 3 for 5
    const coldThreshold = Math.ceil(maxNumbers * 0.4); // 3 for 6, 2 for 5
    const neutralThreshold = Math.ceil(maxNumbers * 0.7); // 5 for 6, 4 for 5

    if (hotCount >= hotThreshold) {
      trend = "🔥 Muy Caliente";
      recommendation = "❄️ Toca Enfriar";
      suggestedHot = Math.floor(maxNumbers * 0.2);
      suggestedCold = Math.floor(maxNumbers * 0.4);
      suggestedNeutral = maxNumbers - suggestedHot - suggestedCold;
    } else if (coldCount >= coldThreshold) {
      trend = "❄️ Muy Frío";
      recommendation = "🔥 Toca Calentar";
      suggestedHot = Math.floor(maxNumbers * 0.5);
      suggestedCold = Math.floor(maxNumbers * 0.1);
      suggestedNeutral = maxNumbers - suggestedHot - suggestedCold;
    } else if (neutralCount >= neutralThreshold) {
      trend = "⚖️ Muy Neutro";
      recommendation = "🌡️ Activar Extremos";
      suggestedHot = Math.floor(maxNumbers * 0.4);
      suggestedCold = Math.floor(maxNumbers * 0.4);
      suggestedNeutral = maxNumbers - suggestedHot - suggestedCold;
    } else {
      trend = "⚖️ Balanceado";
      recommendation = "🔄 Mantener Ciclo";
    }

    // Suggestions for Stars
    let suggestedStarHot = 0;
    let suggestedStarNeutral = 0;
    let suggestedStarCold = 0;

    if (maxStars > 0) {
        suggestedStarHot = Math.floor(maxStars / 2);
        suggestedStarCold = Math.ceil(maxStars / 2);
        suggestedStarNeutral = maxStars - suggestedStarHot - suggestedStarCold;

        if (hotStarCount >= 1) {
            suggestedStarHot = 0;
            suggestedStarCold = 1;
            suggestedStarNeutral = maxStars - 1;
        } else if (coldStarCount >= 1) {
            suggestedStarHot = 1;
            suggestedStarCold = 0;
            suggestedStarNeutral = maxStars - 1;
        }
    }

    if (this.currentTrendLabel) this.currentTrendLabel.textContent = trend;
    if (this.trendRecommendation) this.trendRecommendation.textContent = recommendation;
    
    if (this.suggestedProfile) {
      let html = `
        <div style="margin-bottom: 8px;">
            <div style="font-size: 0.7rem; color: #666; margin-bottom: 4px; font-weight: bold;">NÚMEROS:</div>
            <span class="profile-tag" style="background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${suggestedHot} Calientes</span>
            <span class="profile-tag" style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${suggestedNeutral} Neutros</span>
            <span class="profile-tag" style="background: #e0f2fe; color: #075985; padding: 2px 6px; border-radius: 4px;">${suggestedCold} Fríos</span>
        </div>
      `;

      if (maxStars > 0) {
          html += `
            <div>
                <div style="font-size: 0.7rem; color: #666; margin-bottom: 4px; font-weight: bold;">ESTRELLAS:</div>
                <span class="profile-tag" style="background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${suggestedStarHot} Calientes</span>
                <span class="profile-tag" style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${suggestedStarNeutral} Neutros</span>
                <span class="profile-tag" style="background: #e0f2fe; color: #075985; padding: 2px 6px; border-radius: 4px;">${suggestedStarCold} Fríos</span>
            </div>
          `;
      }
      this.suggestedProfile.innerHTML = html;
    }

    // Guardar perfil sugerido para el motor de correlación
    this.currentSuggestedProfile = { 
        hot: suggestedHot, 
        neutral: suggestedNeutral, 
        cold: suggestedCold,
        starHot: suggestedStarHot,
        starNeutral: suggestedStarNeutral,
        starCold: suggestedStarCold
    };
  }

  classifyNumbers() {
    // Classify Numbers
    const freqs = Object.values(this.numberStats).map(s => s.frequency);
    const sortedFreqs = [...freqs].sort((a, b) => a - b);
    const hotThreshold = sortedFreqs[Math.floor(sortedFreqs.length * 0.7)];
    const coldThreshold = sortedFreqs[Math.floor(sortedFreqs.length * 0.3)];
    this.hotNumbers.clear();
    this.coldNumbers.clear();
    this.absentNumbers.clear();
    
    for (let num = 1; num <= this.currentGame.numberRange; num++) {
      const freq = this.numberStats[num] ? this.numberStats[num].frequency : 0;
      if (freq >= hotThreshold) this.hotNumbers.add(num);
      if (freq <= coldThreshold) this.coldNumbers.add(num);
    }
    
    // Classify Stars
    if (this.currentGame.maxStars > 0) {
        const starFreqs = Object.values(this.starStats).map(s => s.frequency);
        const sortedStarFreqs = [...starFreqs].sort((a, b) => a - b);
        const hotStarThreshold = sortedStarFreqs[Math.floor(sortedStarFreqs.length * 0.7)];
        const coldStarThreshold = sortedStarFreqs[Math.floor(sortedStarFreqs.length * 0.3)];
        this.hotStars.clear();
        this.coldStars.clear();
        this.absentStars.clear();

        for (let star = 1; star <= this.currentGame.starRange; star++) {
            const freq = this.starStats[star] ? this.starStats[star].frequency : 0;
            if (freq >= hotStarThreshold) this.hotStars.add(star);
            if (freq <= coldStarThreshold) this.coldStars.add(star);
        }
    }

    // Calcular números ausentes
    if (this.historicalData.length > 0) {
        const totalDraws = this.historicalData[this.historicalData.length - 1].id;
        
        // Numbers absence
        const numberAbsences: { num: number; absence: number }[] = [];
        for (let num = 1; num <= this.currentGame.numberRange; num++) {
            const absence = totalDraws - (this.numberStats[num] ? this.numberStats[num].lastSeen : 0);
            numberAbsences.push({ num, absence });
        }
        numberAbsences.sort((a, b) => b.absence - a.absence);
        for (let i = 0; i < 5 && i < numberAbsences.length; i++) {
            const num = numberAbsences[i].num;
            if (this.numberStats[num] && this.numberStats[num].lastSeen > 0) {
                 this.absentNumbers.add(num);
            }
        }

        // Stars absence
        if (this.currentGame.maxStars > 0) {
            const starAbsences: { num: number; absence: number }[] = [];
            for (let star = 1; star <= this.currentGame.starRange; star++) {
                const absence = totalDraws - (this.starStats[star] ? this.starStats[star].lastSeen : 0);
                starAbsences.push({ num: star, absence });
            }
            starAbsences.sort((a, b) => b.absence - a.absence);
            for (let i = 0; i < 2 && i < starAbsences.length; i++) {
                const star = starAbsences[i].num;
                if (this.starStats[star] && this.starStats[star].lastSeen > 0) {
                    this.absentStars.add(star);
                }
            }
        }
    }
  }
  updateGridNumberStates() {
    // Update Main Numbers
    for (let i = 1; i <= this.currentGame.numberRange; i++) {
      const ball = document.querySelector(`.number-ball[data-number="${i}"][data-type="number"]`);
      if (ball) {
        ball.classList.remove('hot', 'cold', 'absent', 'suggested', 'favorite', 'excluded');
        const icon = ball.querySelector('.number-icon');
        if (!icon) continue;

        let newIcon = '';
        
        // Priority 0: Excluded (Overrides everything else logically)
        if (this.excludedNumbers.has(i)) {
            ball.classList.add('excluded');
            newIcon = '🚫';
        }
        // Priority 1: Favorites overrides basic stats background
        else if (this.favoriteNumbers.has(i)) {
            ball.classList.add('favorite');
            newIcon = '⭐';
        }

        // Priority 2: Suggested (Border/Animation overlays)
        if (this.suggestedNumbers.has(i) && !this.excludedNumbers.has(i)) {
            ball.classList.add('suggested');
            if (!this.favoriteNumbers.has(i)) {
                newIcon = '💡';
            }
        }

        // Apply Hot/Cold/Absent if NOT Favorite and NOT Excluded
        if (!this.favoriteNumbers.has(i) && !this.excludedNumbers.has(i)) {
            if (this.hotNumbers.has(i)) {
                ball.classList.add('hot');
                newIcon = this.suggestedNumbers.has(i) ? '💡' : '🔥';
            } else if (this.absentNumbers.has(i)) {
                ball.classList.add('absent');
                newIcon = this.suggestedNumbers.has(i) ? '💡' : '👻';
            } else if (this.coldNumbers.has(i)) {
                ball.classList.add('cold');
                newIcon = this.suggestedNumbers.has(i) ? '💡' : '❄️';
            }
        }
        
        icon.textContent = newIcon;
      }
    }

    // Update Stars
    if (this.currentGame.maxStars > 0) {
        for (let i = 1; i <= this.currentGame.starRange; i++) {
            const ball = document.querySelector(`.number-ball[data-number="${i}"][data-type="star"]`);
            if (ball) {
                ball.classList.remove('hot', 'cold', 'absent', 'suggested', 'favorite', 'excluded');
                const icon = ball.querySelector('.number-icon');
                if (!icon) continue;

                let newIcon = '';
                
                if (this.excludedStars.has(i)) {
                    ball.classList.add('excluded');
                    newIcon = '🚫';
                }
                else if (this.favoriteStars.has(i)) {
                    ball.classList.add('favorite');
                    newIcon = '⭐';
                }

                if (this.suggestedStars.has(i) && !this.excludedStars.has(i)) {
                    ball.classList.add('suggested');
                    if (!this.favoriteStars.has(i)) {
                        newIcon = '💡';
                    }
                }

                if (!this.favoriteStars.has(i) && !this.excludedStars.has(i)) {
                    if (this.hotStars.has(i)) {
                        ball.classList.add('hot');
                        newIcon = this.suggestedStars.has(i) ? '💡' : '🔥';
                    } else if (this.absentStars.has(i)) {
                        ball.classList.add('absent');
                        newIcon = this.suggestedStars.has(i) ? '💡' : '👻';
                    } else if (this.coldStars.has(i)) {
                        ball.classList.add('cold');
                        newIcon = this.suggestedStars.has(i) ? '💡' : '❄️';
                    }
                }
                icon.textContent = newIcon;
            }
        }
    }
  }

  // ===== UI SETUP Y EVENTOS =====
  createNumbersGrid() {
    const grid = document.getElementById('numbersGrid');
    const starsGrid = document.getElementById('starsGrid');
    const starsGridContainer = document.getElementById('starsGridContainer');
    const selectionTitle = document.getElementById('selectionTitle');
    
    if (!grid) return;
    grid.innerHTML = '';
    
    if (selectionTitle) {
      selectionTitle.textContent = `Selección de números (${this.currentGame.name})`;
    }

    // Main Numbers Grid
    for (let i = 1; i <= this.currentGame.numberRange; i++) {
      const ball = document.createElement('div');
      ball.classList.add('number-ball');
      ball.dataset.number = String(i);
      ball.dataset.type = 'number';
      ball.innerHTML = `${i}<span class="number-icon"></span>`;
      grid.appendChild(ball);
    }

    // Stars Grid (if applicable)
    if (this.currentGame.maxStars > 0 && starsGrid && starsGridContainer) {
      starsGridContainer.style.display = 'block';
      starsGrid.innerHTML = '';
      
      const starsGridIcon = document.getElementById('starsGridIcon');
      const starsGridText = document.getElementById('starsGridText');
      if (starsGridIcon && starsGridText) {
          if (this.currentGame.id === 'gordo') {
              starsGridIcon.textContent = '🔑';
              starsGridText.textContent = 'Selección de Clave (Llave)';
          } else if (this.currentGame.id === 'eurodreams') {
              starsGridIcon.textContent = '🌙';
              starsGridText.textContent = 'Selección de Sueños';
          } else {
              starsGridIcon.textContent = '⭐';
              starsGridText.textContent = 'Selección de Estrellas';
          }
      }

      const isGordo = this.currentGame.id === 'gordo';
      const startIdx = isGordo ? 0 : 1;
      const endIdx = isGordo ? this.currentGame.starRange - 1 : this.currentGame.starRange;
      for (let i = startIdx; i <= endIdx; i++) {
        const ball = document.createElement('div');
        ball.classList.add('number-ball', 'star-ball');
        ball.dataset.number = String(i);
        ball.dataset.type = 'star';
        ball.innerHTML = `${i}<span class="number-icon"></span>`;
        starsGrid.appendChild(ball);
      }
    } else if (starsGridContainer) {
      starsGridContainer.style.display = 'none';
    }
  }

  switchGame(gameId: string) {
    if (!GAMES[gameId]) return;
    
    // Save current filters before switching
    this.gameFilters[this.currentGame.id] = this.filters;

    this.currentGame = GAMES[gameId];
    
    // Load filters for the new game
    this.filters = this.normalizeFilters(this.gameFilters[gameId], gameId);

    // Clear ALL states when switching games as they are game-specific
    this.clearSelections(true); 
    this.historicalData = [];
    this.dataLoaded = false;
    
    // Update sidebar active state
    document.querySelectorAll('.sidebar-links li').forEach(li => {
      li.classList.remove('active');
    });
    const activeLi = document.getElementById(`game-${gameId}`);
    if (activeLi) activeLi.classList.add('active');

    // Update Header Title
    const headerTitle = document.querySelector('.header h1');
    if (headerTitle) {
        if (gameId === 'bonoloto') {
            headerTitle.textContent = 'Bonoloto 6/49';
        } else if (gameId === 'primitiva') {
            headerTitle.textContent = 'La Primitiva 6/49';
        } else if (gameId === 'euromillones') {
            headerTitle.textContent = 'Euromillones 5/50 ⭐2/12';
        } else if (gameId === 'eurodreams') {
            headerTitle.textContent = 'EuroDreams 6/40 🌙1/5';
        } else if (gameId === 'gordo') {
            headerTitle.textContent = 'El Gordo 5/54 🔑1/10';
        } else {
            headerTitle.textContent = '🎲 DataLotto49';
        }
    }

    // Re-render filter options for the new game
    this.renderFilterOptions();
    this.updateUIFromFilterState(); // Ensure UI reflects the loaded filters for this game

    // Re-create grid and reset stats for the new game
    this.createNumbersGrid();
    this.initializeHistoricalData(); // This will simulate or load data for the new game
    this.analyzeNumbers();
    this.updateGridNumberStates();
    this.updateDataAnalysis();
    this.updateFilterBadgesFromAudit();
    this.closeSidebar();
    
    this.showToast(`Cambiado a ${this.currentGame.name}`, 'success');
  }

  getCommonConsecutivePatterns(maxNumbers: number): string[] {
    if (maxNumbers === 6) {
        return ["6", "5/1", "4/2", "4/1/1", "3/3", "3/2/1", "3/1/1/1", "2/2/2", "2/2/1/1", "2/1/1/1/1", "1/1/1/1/1/1"];
    } else if (maxNumbers === 5) {
        return ["5", "4/1", "3/2", "3/1/1", "2/2/1", "2/1/1/1", "1/1/1/1/1"];
    } else if (maxNumbers === 2) {
        return ["2", "1/1"];
    }
    return [String(maxNumbers)];
  }

  renderFilterOptions() {
    const maxNumbers = this.currentGame.maxNumbers;
    const maxStars = this.currentGame.maxStars;
    const numberRange = this.currentGame.numberRange;
    const starRange = this.currentGame.starRange;

    // 1. Update Par/Impar Options
    const parImparOptions = document.getElementById('parImparOptions');
    if (parImparOptions) {
      parImparOptions.innerHTML = '';
      for (let p = maxNumbers; p >= 0; p--) {
        const i = maxNumbers - p;
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        if (p === Math.floor(maxNumbers/2) || p === Math.ceil(maxNumbers/2)) chip.classList.add('active');
        chip.dataset.value = `${p}/${i}`;
        chip.textContent = `${p}P/${i}I`;
        parImparOptions.appendChild(chip);
      }
    }

    // 2. Update Bajos/Altos Options
    const bajosAltosOptions = document.getElementById('bajosAltosOptions');
    if (bajosAltosOptions) {
      bajosAltosOptions.innerHTML = '';
      for (let b = maxNumbers; b >= 0; b--) {
        const a = maxNumbers - b;
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        if (b === Math.floor(maxNumbers/2) || b === Math.ceil(maxNumbers/2)) chip.classList.add('active');
        chip.dataset.value = `${b}/${a}`;
        chip.textContent = `${b}B/${a}A`;
        bajosAltosOptions.appendChild(chip);
      }
    }

    // 3. Update Consecutivos Options
    const consecutivosOptions = document.getElementById('consecutivosOptions');
    if (consecutivosOptions) {
        consecutivosOptions.innerHTML = '';
        const patterns = this.getCommonConsecutivePatterns(maxNumbers);
        patterns.forEach(p => {
            const chip = document.createElement('div');
            chip.className = 'filter-chip';
            if (p === patterns[patterns.length-1] || p === patterns[patterns.length-2]) chip.classList.add('active');
            chip.dataset.value = p;
            chip.textContent = p;
            consecutivosOptions.appendChild(chip);
        });
    }

    // 4. Update AgrupDecenas Options
    const agrupDecenasOptions = document.getElementById('agrupDecenasOptions');
    if (agrupDecenasOptions) {
        agrupDecenasOptions.innerHTML = '';
        const patterns = this.getCommonConsecutivePatterns(maxNumbers);
        patterns.forEach(p => {
            const chip = document.createElement('div');
            chip.className = 'filter-chip active';
            chip.dataset.value = p;
            chip.textContent = p;
            agrupDecenasOptions.appendChild(chip);
        });
    }

    // 5. Update Range Inputs Max/Min for Numbers
    const sumMin = document.getElementById('sumMin') as HTMLInputElement;
    const sumMax = document.getElementById('sumMax') as HTMLInputElement;
    if (sumMin && sumMax) {
        let min = 0; for(let i=1; i<=maxNumbers; i++) min += i;
        let max = 0; for(let i=0; i<maxNumbers; i++) max += (numberRange - i);
        sumMin.min = String(min); sumMin.max = String(max);
        sumMax.min = String(min); sumMax.max = String(max);
        // Adjust values if current are out of range
        if (parseInt(sumMin.value) < min || parseInt(sumMin.value) > max) sumMin.value = String(min + Math.floor((max-min)*0.3));
        if (parseInt(sumMax.value) > max || parseInt(sumMax.value) < min) sumMax.value = String(min + Math.floor((max-min)*0.7));
    }

    const sumaDigitosMin = document.getElementById('sumaDigitosMin') as HTMLInputElement;
    const sumaDigitosMax = document.getElementById('sumaDigitosMax') as HTMLInputElement;
    if (sumaDigitosMin && sumaDigitosMax) {
        // Min suma digitos: 1+2+3+4+5 = 15
        // Max suma digitos: e.g. 45+46+47+48+49 -> (4+5)+(4+6)+(4+7)+(4+8)+(4+9) = 9+10+11+12+13 = 55
        let min = 0; for(let i=1; i<=maxNumbers; i++) min += (i < 10 ? i : (i % 10 + Math.floor(i/10)));
        let max = 0; for(let i=0; i<maxNumbers; i++) {
            const n = numberRange - i;
            max += (n < 10 ? n : (n % 10 + Math.floor(n/10)));
        }
        sumaDigitosMin.min = String(min); sumaDigitosMin.max = String(max);
        sumaDigitosMax.min = String(min); sumaDigitosMax.max = String(max);
        if (parseInt(sumaDigitosMin.value) < min || parseInt(sumaDigitosMin.value) > max) sumaDigitosMin.value = String(min + Math.floor((max-min)*0.3));
        if (parseInt(sumaDigitosMax.value) > max || parseInt(sumaDigitosMax.value) < min) sumaDigitosMax.value = String(min + Math.floor((max-min)*0.7));
    }

    // 6. Primos Range
    const primosMin = document.getElementById('primosMin') as HTMLInputElement;
    const primosMax = document.getElementById('primosMax') as HTMLInputElement;
    if (primosMin && primosMax) {
        primosMin.max = String(maxNumbers);
        primosMax.max = String(maxNumbers);
        if (parseInt(primosMax.value) > maxNumbers) primosMax.value = String(maxNumbers);
    }

    // 7. Star Filters Section
    const starSection = document.getElementById('starFiltersSection');
    if (starSection) {
        if (maxStars > 1) {
            starSection.style.display = 'block';
            this.renderStarFilterOptions();
        } else {
            starSection.style.display = 'none';
        }
    }

    // 8. Multiple Strategy Options
    this.renderMultipleStrategyOptions();
  }

  renderMultipleStrategyOptions() {
      const multipleOptions = document.getElementById('multipleNumbersOptions');
      if (!multipleOptions) return;

      const isEuromillones = this.currentGame.id === 'euromillones';
      const maxNumbers = this.currentGame.maxNumbers;
      const maxStars = this.currentGame.maxStars;

      let html = '<div class="numbers-select">';
      html += `<label style="font-weight: 600; color: var(--dark); margin-bottom: 8px; display: block;">¿Cuántos números quieres seleccionar? (${this.currentGame.name})</label>`;
      html += '<div class="multiple-options-container" style="display: flex; flex-direction: column; gap: 4px; margin-top: 10px;">';
      
      const isMain5 = this.currentGame.maxNumbers === 5;
      const numOptions = isMain5 ? [6, 7, 8, 9, 10] : [7, 8, 9, 10, 11];
      numOptions.forEach(n => {
          html += `<div class="number-option ${n === numOptions[0] ? 'active' : ''}" data-numbers="${n}">${n} números</div>`;
      });
      html += '</div>';

      if (this.currentGame.maxStars > 0) {
          const dreamName = this.currentGame.id === 'eurodreams' ? 'Sueños' : (this.currentGame.id === 'gordo' ? 'Clave 🔑' : 'Estrellas ⭐');
          html += `<label style="margin-top: 20px; display: block; font-weight: 600; color: var(--dark); margin-bottom: 8px;">¿Cuántos/as ${this.currentGame.id === 'gordo' ? 'Claves 🔑' : dreamName} quieres seleccionar?</label>`;
          html += '<div class="star-multiple-options-container" style="display: flex; flex-direction: column; gap: 4px; margin-top: 10px;">';
          const starMin = this.currentGame.maxStars;
          const starOptions = [starMin, starMin + 1, starMin + 2];
          starOptions.forEach(s => {
              html += `<div class="star-multiple-option ${s === starMin ? 'active' : ''}" data-stars="${s}">${s} ${this.currentGame.id === 'gordo' ? 'Clave 🔑' : dreamName}</div>`;
          });
          html += '</div>';
      }
      
      html += '</div>';
      multipleOptions.innerHTML = html;

      // Re-bind events for new options
      multipleOptions.querySelectorAll('.number-option').forEach(opt => {
          opt.addEventListener('click', () => {
              multipleOptions.querySelectorAll('.number-option').forEach(o => o.classList.remove('active'));
              opt.classList.add('active');
          });
      });

      if (this.currentGame.maxStars > 0) {
          multipleOptions.querySelectorAll('.star-multiple-option').forEach(opt => {
              opt.addEventListener('click', () => {
                  multipleOptions.querySelectorAll('.star-multiple-option').forEach(o => o.classList.remove('active'));
                  opt.classList.add('active');
              });
          });
      }
  }

  renderStarFilterOptions() {
    const maxStars = this.currentGame.maxStars;
    const starRange = this.currentGame.starRange;

    // Par/Impar Estrellas
    const starParImparOptions = document.getElementById('starParImparOptions');
    if (starParImparOptions) {
        starParImparOptions.innerHTML = '';
        for (let p = maxStars; p >= 0; p--) {
            const i = maxStars - p;
            const chip = document.createElement('div');
            chip.className = 'filter-chip active';
            chip.dataset.value = `${p}/${i}`;
            chip.textContent = `${p}P/${i}I`;
            starParImparOptions.appendChild(chip);
        }
    }

    // Bajos/Altos Estrellas
    const starBajosAltosOptions = document.getElementById('starBajosAltosOptions');
    if (starBajosAltosOptions) {
        starBajosAltosOptions.innerHTML = '';
        for (let b = maxStars; b >= 0; b--) {
            const a = maxStars - b;
            const chip = document.createElement('div');
            chip.className = 'filter-chip active';
            chip.dataset.value = `${b}/${a}`;
            chip.textContent = `${b}B/${a}A`;
            starBajosAltosOptions.appendChild(chip);
        }
    }

    // Consecutivos Estrellas
    const starConsecutivosOptions = document.getElementById('starConsecutivosOptions');
    if (starConsecutivosOptions) {
        starConsecutivosOptions.innerHTML = '';
        const patterns = this.getCommonConsecutivePatterns(maxStars);
        patterns.forEach(p => {
            const chip = document.createElement('div');
            chip.className = 'filter-chip active';
            chip.dataset.value = p;
            chip.textContent = p;
            starConsecutivosOptions.appendChild(chip);
        });
    }

    // Ranges for Stars
    const starSumMin = document.getElementById('starSumMin') as HTMLInputElement;
    const starSumMax = document.getElementById('starSumMax') as HTMLInputElement;
    if (starSumMin && starSumMax) {
        let min = 0; for(let i=1; i<=maxStars; i++) min += i;
        let max = 0; for(let i=0; i<maxStars; i++) max += (starRange - i);
        starSumMin.min = String(min); starSumMin.max = String(max);
        starSumMax.min = String(min); starSumMax.max = String(max);
        starSumMin.value = String(min);
        starSumMax.value = String(max);
    }

    const starSumaDigitosMin = document.getElementById('starSumaDigitosMin') as HTMLInputElement;
    const starSumaDigitosMax = document.getElementById('starSumaDigitosMax') as HTMLInputElement;
    if (starSumaDigitosMin && starSumaDigitosMax) {
        // Calculate all possible digit sums for numbers in starRange
        const digitSums: number[] = [];
        for (let i = 1; i <= starRange; i++) {
            const sum = i < 10 ? i : (i % 10 + Math.floor(i / 10));
            digitSums.push(sum);
        }
        digitSums.sort((a, b) => a - b);
        
        let min = 0;
        for (let i = 0; i < maxStars; i++) min += digitSums[i];
        
        let max = 0;
        const reverseDigitSums = [...digitSums].sort((a, b) => b - a);
        for (let i = 0; i < maxStars; i++) max += reverseDigitSums[i];

        starSumaDigitosMin.min = String(min); starSumaDigitosMin.max = String(max);
        starSumaDigitosMax.min = String(min); starSumaDigitosMax.max = String(max);
        starSumaDigitosMin.value = String(min);
        starSumaDigitosMax.value = String(max);
    }

    const starPrimosMin = document.getElementById('starPrimosMin') as HTMLInputElement;
    const starPrimosMax = document.getElementById('starPrimosMax') as HTMLInputElement;
    if (starPrimosMin && starPrimosMax) {
        starPrimosMin.max = String(maxStars);
        starPrimosMax.max = String(maxStars);
    }

    const starDistanciaMin = document.getElementById('starDistanciaMin') as HTMLInputElement;
    const starDistanciaMax = document.getElementById('starDistanciaMax') as HTMLInputElement;
    if (starDistanciaMin && starDistanciaMax) {
        starDistanciaMin.max = String(starRange - 1);
        starDistanciaMax.max = String(starRange - 1);
    }
  }

  bindEvents() {
    document.getElementById('savedTicketsGameFilter')?.addEventListener('change', () => {
        this.updateSavedTickets();
    });

    document.getElementById('numbersGrid')?.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('number-ball')) this.handleNumberClick(target);
    });
    
    document.getElementById('starsGrid')?.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('number-ball')) this.handleNumberClick(target);
    });

    document.querySelectorAll('[data-action="switch-game"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const gameId = (e.currentTarget as HTMLElement).dataset.game;
        if (gameId) this.switchGame(gameId);
      });
    });
    document.querySelector('.selection-mode-controls')?.addEventListener('click', e => {
        // FIX: Cast e.target to HTMLElement to use closest()
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.selection-mode-btn');
        if (!btn) return;
        const mode = btn.dataset.mode;
        
        // Ensure specific check for mode string to fix bug where button might not activate
        if (mode && ['cold', 'hot', 'excluded', 'figure', 'absent', 'favorites'].includes(mode)) {
            this.updateSelectionMode(mode as 'cold' | 'hot' | 'excluded' | 'figure' | 'absent' | 'favorites');
        } else if (btn.id === 'randomBtn') {
            this.randomSelect();
        } else if (btn.id === 'clearBtn') {
            this.clearSelections(true);
            const clearBtn = document.getElementById('clearBtn');
            if (clearBtn) {
              clearBtn.classList.add('shake');
              setTimeout(() => clearBtn.classList.remove('shake'), 500);
            }
        } else if (btn.id === 'dataBtn') {
            document.getElementById('fileInput')?.click();
        } else if (btn.id === 'simulateBtn') {
            this.simulateHistoricalData(500);
        } else if (btn.id === 'urlBtn') {
            this.loadDataFromUrl();
        }
    });
    document.querySelectorAll('.collapsible-header').forEach(h => h.addEventListener('click', () => {
        // FIX: Cast to HTMLElement to access dataset
        this.toggleCollapse((h as HTMLElement).dataset.target!)
    }));
    document.querySelectorAll('.strategy-buttons .strategy-btn').forEach(btn => btn.addEventListener('click', () => {
        // FIX: Cast to HTMLElement to access dataset
        this.updateStrategyUI((btn as HTMLElement).dataset.strategy!)
    }));
    document.querySelectorAll('.number-option').forEach(opt => opt.addEventListener('click', () => {
      document.querySelectorAll('.number-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    }));
    document.getElementById('generateBtn')?.addEventListener('click', () => this.generateCombinations());
    document.getElementById('saveBtn')?.addEventListener('click', () => this.saveTicket());
    document.getElementById('shareBtn')?.addEventListener('click', () => this.shareTicket());
    document.getElementById('playOnlineBtn')?.addEventListener('click', () => this.playTicketOnline(this.currentTicket!));
    document.querySelector('.filters-panel')?.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.type === 'range') {
            const display = document.getElementById(`${target.id}Value`);
            if (display) display.textContent = target.value;
        }
        this.updateFilterBadgesFromAudit();
    });
    document.querySelector('.filters-panel')?.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.type === 'range') return; // already handled by input event
        this.updateFilterBadgesFromAudit();
    });
    document.querySelector('.filters-panel')?.addEventListener('click', e => {
        // FIX: Cast to HTMLElement to access classList
       const target = e.target as HTMLElement;
       if(target.classList.contains('filter-chip')) {
           target.classList.toggle('active');
           this.updateFilterBadgesFromAudit();
       }
    });
    document.getElementById('disclaimerBtn')?.addEventListener('click', () => this.toggleModal('disclaimerModal', true));
    document.getElementById('disclaimerCloseBtn')?.addEventListener('click', () => this.toggleModal('disclaimerModal', false));
    
    // Sidebar & Menu Events
    document.getElementById('menuBtn')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('overlay')?.addEventListener('click', () => this.closeSidebar());
    document.querySelectorAll('.sidebar-links a:not(.disabled)').forEach(link => {
        link.addEventListener('click', (e) => {
            const action = (e.currentTarget as HTMLElement).dataset.action;
            if (action === 'home') {
                this.showMainApp();
                this.closeSidebar();
            }
        });
    });

    document.getElementById('configUrlsBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.openConfigUrlsModal();
    });
    document.getElementById('contactBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.openContactModal();
    });
    document.getElementById('closeContactBtn')?.addEventListener('click', () => this.toggleModal('contactModal', false));
    document.getElementById('sendContactBtn')?.addEventListener('click', () => this.sendContactForm());
    
    document.getElementById('closeConfigUrlsBtn')?.addEventListener('click', () => this.toggleModal('configUrlsModal', false));
    document.getElementById('saveConfigUrlsBtn')?.addEventListener('click', () => this.saveConfigUrls());

    document.getElementById('cancelSetUrlPromptBtn')?.addEventListener('click', () => this.toggleModal('setUrlPromptModal', false));
    document.getElementById('saveSetUrlPromptBtn')?.addEventListener('click', () => {
        const input = document.getElementById('setUrlPromptInput') as HTMLInputElement;
        const gameKey = (this as any).pendingPlayGameKey;
        if (!input || !gameKey) return;
        
        let val = input.value.trim();
        if (!val) {
            this.showToast('Por favor, escribe un enlace válido.', 'warning');
            return;
        }
        
        if (!/^https?:\/\//i.test(val)) {
            val = 'https://' + val;
        }
        
        this.customGameUrls[gameKey] = val;
        this.saveState();
        this.toggleModal('setUrlPromptModal', false);
        this.showToast('✅ Enlace configurado correctamente.', 'success');
        
        // Retry playing online with the new URL!
        this.confirmPlayOnline(gameKey);
    });

    document.getElementById('closeGameSelectionBtn')?.addEventListener('click', () => this.toggleModal('gameSelectionModal', false));
    document.getElementById('closePlayOnlineModalBtn')?.addEventListener('click', () => this.toggleModal('playOnlineModal', false));
    document.querySelectorAll('.play-online-choice-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const game = (e.currentTarget as HTMLElement).dataset.game;
            if (game === 'bonoloto' || game === 'primitiva') {
                this.confirmPlayOnline(game);
            }
        });
    });
    document.getElementById('cancelValidationBtn')?.addEventListener('click', () => this.toggleModal('validationModal', false));
    document.getElementById('confirmValidationBtn')?.addEventListener('click', () => this.confirmValidation());
    // FIX: Cast e.target to HTMLInputElement to access files
    document.getElementById('fileInput')?.addEventListener('change', e => (e.target as HTMLInputElement).files!.length > 0 && this.loadRealData((e.target as HTMLInputElement).files!));
    
    // Big Data Events
    document.getElementById('nextDrawDay')?.addEventListener('change', (e) => {
        this.updateBigDataPanel();
    });
    document.querySelectorAll('.bd-strat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = (e.currentTarget as HTMLElement).dataset.type;
            this.applyBigDataStrategy(type!);
        });
    });

    // Filter Presets Events
    document.getElementById('loadFiltersBtn')?.addEventListener('click', () => this.openLoadFilterModal());
    document.getElementById('aiPredictBtn')?.addEventListener('click', () => this.handleAiPrediction());
    document.getElementById('closeAiPredictionBtn')?.addEventListener('click', () => this.toggleModal('aiPredictionModal', false));
    document.getElementById('applyAiNumbersBtn')?.addEventListener('click', () => this.applyAiNumbers());
    document.getElementById('saveFiltersBtn')?.addEventListener('click', () => this.openSaveFilterModal());
    document.getElementById('aiFiltersBtn')?.addEventListener('click', () => this.applyAiFilters());
    document.getElementById('closeSaveFilterBtn')?.addEventListener('click', () => this.toggleModal('saveFilterModal', false));
    document.getElementById('confirmSaveFilterBtn')?.addEventListener('click', () => this.confirmSaveFilter());
    document.getElementById('closeLoadFilterBtn')?.addEventListener('click', () => this.toggleModal('loadFilterModal', false));

    document.getElementById('filtersDashboardBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.showFiltersDashboard();
    });

    // Dashboard Filters Events
    document.querySelectorAll('.db-filter-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            this.handleDashboardFilterClick(target);
        });
    });

    document.getElementById('dbClearFiltersBtn')?.addEventListener('click', () => {
        this.clearDashboardFilters();
    });

    // Dashboard Tabs Events
    document.querySelectorAll('.db-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const tabId = target.dataset.tab!;
            this.switchDashboardTab(tabId);
        });
    });

    document.getElementById('dbBackToMainBtn')?.addEventListener('click', () => {
        this.showMainApp();
    });

    document.getElementById('runBacktestBtn')?.addEventListener('click', () => {
        this.runBacktest();
    });

  }

  // ===== FILTROS (Reactivados y completos) =====
  updateFilterStateFromUI() {
      // FIX: Added type safety for DOM element access.
      const getVal = (id: string, isFloat = false): number => {
          const el = document.getElementById(id) as HTMLInputElement;
          if (!el) return isFloat ? 0.0 : 0;
          return isFloat ? parseFloat(el.value) : parseInt(el.value);
      };
      const getChecked = (id: string): boolean => (document.getElementById(id) as HTMLInputElement)?.checked || false;
      const getActiveChips = (selector: string): string[] => Array.from(document.querySelectorAll(selector)).map(el => (el as HTMLElement).dataset.value!);

      this.filters.terminaciones = getActiveChips('#terminacionesOptions .filter-chip.active').map(Number);
      this.filters.terminacionesDistintas = getActiveChips('#terminacionesDistintasOptions .filter-chip.active').map(Number);
      this.filters.sum = { min: getVal('sumMin'), max: getVal('sumMax') };
      this.filters.parImpar = getActiveChips('#parImparOptions .filter-chip.active');
      this.filters.bajosAltos = getActiveChips('#bajosAltosOptions .filter-chip.active');
      this.filters.primos = { min: getVal('primosMin'), max: getVal('primosMax') };
      this.filters.consecutivos = getActiveChips('#consecutivosOptions .filter-chip.active');
      this.filters.distancia = { min: getVal('distanciaMin'), max: getVal('distanciaMax') };
      this.filters.agrupDecenas = getActiveChips('#agrupDecenasOptions .filter-chip.active');
      this.filters.sumaDigitos = { min: getVal('sumaDigitosMin'), max: getVal('sumaDigitosMax') };
      this.filters.desviacion = { min: getVal('desviacionMin', true), max: getVal('desviacionMax', true) };
      this.filters.entropyTerminaciones = { min: getVal('entropyTerminacionesMin', true), max: getVal('entropyTerminacionesMax', true) };
      this.filters.entropyIntervalos = { min: getVal('entropyIntervalosMin', true), max: getVal('entropyIntervalosMax', true) };
      
      // Star filters
      this.filters.starSum = { min: getVal('starSumMin'), max: getVal('starSumMax') };
      this.filters.starParImpar = getActiveChips('#starParImparOptions .filter-chip.active');
      this.filters.starBajosAltos = getActiveChips('#starBajosAltosOptions .filter-chip.active');
      this.filters.starSumaDigitos = { min: getVal('starSumaDigitosMin'), max: getVal('starSumaDigitosMax') };
      this.filters.starPrimos = { min: getVal('starPrimosMin'), max: getVal('starPrimosMax') };
      this.filters.starConsecutivos = getActiveChips('#starConsecutivosOptions .filter-chip.active');
      this.filters.starDistancia = { min: getVal('starDistanciaMin'), max: getVal('starDistanciaMax') };

      const geometricChips = Array.from(document.querySelectorAll('#geometricOptions .filter-chip.active')) as HTMLElement[];
      this.filters.geometric = {
          exclude: geometricChips.filter(el => el.textContent!.startsWith('🚫')).map(el => el.dataset.value!),
          favor: geometricChips.filter(el => el.textContent!.startsWith('👍')).map(el => el.dataset.value!),
      };
      
      this.filters.useMarkov = getChecked('useMarkovSwitch');
      this.filters.useNash = getChecked('useNashSwitch');
      this.filters.useRegression = getChecked('useRegressionSwitch');
      
      this.filters.ai.markovDepth = getVal('markovDepth');
      this.filters.ai.nashWeight = getVal('nashWeight');
      this.filters.ai.regressionBonus = getVal('regressionBonus');

      this.saveState();
  }

  // ===== SELECCIÓN DE NÚMEROS (CORREGIDO) =====
  handleNumberClick(ball: HTMLElement) {
    const number = parseInt(ball.dataset.number!);
    const type = (ball.dataset.type || 'number') as 'number' | 'star';
    const icon = ball.querySelector('.number-icon');
    if (!icon) return;
    
    const excludedSet = type === 'number' ? this.excludedNumbers : this.excludedStars;
    const selectedSet = type === 'number' ? this.selectedNumbers : this.selectedStars;
    const favoriteSet = type === 'number' ? this.favoriteNumbers : this.favoriteStars;
    const hotSet = type === 'number' ? this.hotNumbers : this.hotStars;
    const coldSet = type === 'number' ? this.coldNumbers : this.coldStars;
    const absentSet = type === 'number' ? this.absentNumbers : this.absentStars;
    const suggestedSet = type === 'number' ? this.suggestedNumbers : this.suggestedStars;

    if (excludedSet.has(number) && this.currentSelectionMode !== 'excluded') {
        this.showToast('Este número está excluido.', 'warning');
        return;
    }

    // Si es una sugerencia, al hacer click la aceptamos
    if (suggestedSet.has(number) && this.currentSelectionMode === null) {
        suggestedSet.delete(number);
        ball.classList.remove('suggested');
        this.addNumber(number, type); // Añadir a seleccionados
        this.updateGridNumberStates(); 
        return;
    }

    switch (this.currentSelectionMode) {
        case 'favorites':
            if (favoriteSet.has(number)) {
                favoriteSet.delete(number);
                ball.classList.remove('favorite');
                icon.textContent = '';
                this.updateGridNumberStates();
            } else {
                if (favoriteSet.size >= 10) {
                    this.showToast('Máximo 10 favoritos permitidos.', 'warning');
                    return;
                }
                favoriteSet.add(number);
                ball.classList.add('favorite');
                icon.textContent = '⭐';
            }
            this.saveState();
            break;

        case 'excluded':
            if (selectedSet.has(number)) {
                this.showToast('No puedes excluir un número ya seleccionado.', 'warning');
                return;
            }
            excludedSet.has(number) ? excludedSet.delete(number) : excludedSet.add(number);
            this.updateGridNumberStates();
            break;

        case 'hot':
            if (coldSet.has(number)) coldSet.delete(number);
            if (absentSet.has(number)) absentSet.delete(number);
            hotSet.has(number) ? hotSet.delete(number) : hotSet.add(number);
            this.updateGridNumberStates();
            break;

        case 'cold':
            if (hotSet.has(number)) hotSet.delete(number);
            if (absentSet.has(number)) absentSet.delete(number);
            coldSet.has(number) ? coldSet.delete(number) : coldSet.add(number);
            this.updateGridNumberStates();
            break;

        case 'absent':
            if (hotSet.has(number)) hotSet.delete(number);
            if (coldSet.has(number)) coldSet.delete(number);
            absentSet.has(number) ? absentSet.delete(number) : absentSet.add(number);
            this.updateGridNumberStates();
            break;

        case 'figure':
            if (type === 'number') {
              ball.classList.toggle('figure-selection');
            }
            break;

        default:
            if (selectedSet.has(number)) {
                this.removeNumber(number, type);
            } else {
                this.addNumber(number, type);
            }
            break;
    }
  }

  addNumber(number: number, type: 'number' | 'star' = 'number') {
    const strategy = (document.querySelector('.strategy-buttons .strategy-btn.active') as HTMLElement)?.dataset.strategy || 'simple';
    const isMultiple = strategy === 'multiple';
    const isEuromillones = this.currentGame.id === 'euromillones';

    if (type === 'number') {
      const limit = isMultiple ? (this.currentGame.maxNumbers === 5 ? 10 : 11) : this.currentGame.maxNumbers;
      if (this.selectedNumbers.size < limit) {
        this.selectedNumbers.add(number);
        document.querySelector(`.number-ball[data-number="${number}"][data-type="number"]`)?.classList.add('selected');
      } else {
        this.showToast(`Límite de ${limit} números alcanzado.`, 'warning');
      }
    } else {
      const limit = isMultiple ? 5 : this.currentGame.maxStars;
      if (this.selectedStars.size < limit) {
        this.selectedStars.add(number);
        document.querySelector(`.number-ball[data-number="${number}"][data-type="star"]`)?.classList.add('selected');
      } else {
        this.showToast(`Límite de ${limit} estrellas alcanzado.`, 'warning');
      }
    }
    this.updateSelectedDisplay();
    this.updateStats();
    this.updateCorrelationScore();
  }

  removeNumber(number: number, type: 'number' | 'star' = 'number') {
    if (type === 'number') {
      this.selectedNumbers.delete(number);
      document.querySelector(`.number-ball[data-number="${number}"][data-type="number"]`)?.classList.remove('selected');
    } else {
      this.selectedStars.delete(number);
      document.querySelector(`.number-ball[data-number="${number}"][data-type="star"]`)?.classList.remove('selected');
    }
    this.updateSelectedDisplay();
    this.updateStats();
    this.updateCorrelationScore();
  }

  clearSelections(fullClear: boolean) {
    this.selectedNumbers.clear();
    this.selectedStars.clear();
    this.suggestedNumbers.clear();
    this.suggestedStars.clear();
    document.querySelectorAll('.number-ball.figure-selection').forEach(b => b.classList.remove('figure-selection'));
    
    if (fullClear) {
      this.excludedNumbers.clear();
      this.excludedStars.clear();
      this.hotNumbers.clear();
      this.hotStars.clear();
      this.coldNumbers.clear();
      this.coldStars.clear();
      this.absentNumbers.clear();
      this.absentStars.clear();
      this.favoriteNumbers.clear();
      this.favoriteStars.clear();
      
      document.querySelectorAll('.number-ball').forEach(b => {
          b.classList.remove('excluded', 'hot', 'cold', 'absent', 'suggested', 'favorite');
          const icon = b.querySelector('.number-icon');
          if (icon) icon.textContent = '';
      });
      this.saveState();
    }
    document.querySelectorAll('.number-ball.selected').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.number-ball.suggested').forEach(b => b.classList.remove('suggested'));
    this.clearGridHighlights();
    this.updateSelectedDisplay();
    this.updateStats();
    this.updateCorrelationScore();
  }
  randomSelect() {
    this.clearSelections(false);
    const availableNumbers = this.getAvailableUniverse('number');
    const availableStars = this.getAvailableUniverse('star');
    
    if (availableNumbers.length < this.currentGame.maxNumbers) {
      this.showToast(`No hay suficientes números para seleccionar ${this.currentGame.maxNumbers} al azar.`, 'warning');
      return;
    }
    if (this.currentGame.maxStars > 0 && availableStars.length < this.currentGame.maxStars) {
        this.showToast(`No hay suficientes estrellas para seleccionar ${this.currentGame.maxStars} al azar.`, 'warning');
        return;
    }
    
    const randomNumbers: number[] = [];
    while (randomNumbers.length < this.currentGame.maxNumbers) {
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const number = availableNumbers.splice(randomIndex, 1)[0];
      randomNumbers.push(number);
      const ball = document.querySelector(`.number-ball[data-number="${number}"][data-type="number"]`);
      if (ball) {
        ball.classList.add('random-pick');
        const icon = ball.querySelector('.number-icon');
        if (icon) icon.textContent = '🎲';
      }
    }

    const randomStars: number[] = [];
    if (this.currentGame.maxStars > 0) {
        while (randomStars.length < this.currentGame.maxStars) {
            const randomIndex = Math.floor(Math.random() * availableStars.length);
            const number = availableStars.splice(randomIndex, 1)[0];
            randomStars.push(number);
            const ball = document.querySelector(`.number-ball[data-number="${number}"][data-type="star"]`);
            if (ball) {
                ball.classList.add('random-pick');
                const icon = ball.querySelector('.number-icon');
                if (icon) icon.textContent = '🎲';
            }
        }
    }
    
    this.selectedNumbers = new Set(randomNumbers);
    this.selectedStars = new Set(randomStars);
    this.updateTopDisplayWithCombination(randomNumbers, 'random', randomStars);
    this.updateStats();
    this.updateCorrelationScore();
  }
  getAvailableUniverse(type: 'number' | 'star' = 'number'): number[] {
    // If in figure mode and type is number, the universe is the selected numbers
    if (type === 'number' && this.currentSelectionMode === 'figure' && this.selectedNumbers.size > 0) {
        return Array.from(this.selectedNumbers);
    }

    const range = type === 'number' ? this.currentGame.numberRange : this.currentGame.starRange;
    const excluded = type === 'number' ? this.excludedNumbers : this.excludedStars;
    const universe: number[] = [];
    
    for (let i = 1; i <= range; i++) {
      if (excluded.has(i)) continue;
      
      // Additional filter for main numbers: excluded endings
      if (type === 'number' && this.filters.terminaciones && this.filters.terminaciones.length > 0 && this.filters.terminaciones.includes(i % 10)) {
          continue;
      }
      
      universe.push(i);
    }
    return universe;
  }
  updateSelectionMode(mode: 'excluded' | 'hot' | 'cold' | 'figure' | 'absent' | 'favorites') {
    const isTogglingOff = this.currentSelectionMode === mode;
    
    // Clear previous mode state
    if (this.currentSelectionMode === 'figure') {
        this.clearSelections(false); // Clear figure selections
    }
    this.currentSelectionMode = null;

    document.querySelectorAll('.selection-mode-btn[data-mode]').forEach(b => {
        // FIX: Cast to HTMLElement to access dataset
        const btn = b as HTMLElement;
        if (['cold', 'hot', 'excluded', 'figure', 'absent', 'favorites'].includes(btn.dataset.mode!)) {
            btn.classList.remove('active');
        }
    });

    if (isTogglingOff) {
        this.showToast('Modo de selección normal activado', 'info');
    } else {
        this.currentSelectionMode = mode;
        document.querySelector(`.selection-mode-btn[data-mode="${mode}"]`)?.classList.add('active');
        const modeText = {
            excluded: 'marcar números excluidos',
            hot: 'marcar números Calientes',
            cold: 'marcar números Fríos',
            figure: 'dibujar una Figura',
            absent: 'marcar números Ausentes',
            favorites: 'marcar números Favoritos'
        };
        this.showToast(`Modo para ${modeText[mode]} activado`, 'info');
        if (mode === 'figure') {
            this.clearSelections(false);
        }
    }
  }
  updateSelectedDisplay() {
    const display = document.getElementById('selectedDisplay');
    if (!display) return;
    display.innerHTML = '';
    
    if (this.currentSelectionMode === 'figure') {
        const count = this.selectedNumbers.size;
        display.innerHTML = `<div style="color:#666; font-style: italic;">${count} números seleccionados para la figura.</div>`;
        return;
    }
    
    if (this.selectedNumbers.size === 0 && this.selectedStars.size === 0) {
      display.innerHTML = `<div style="color:#666; font-style: italic;">Selecciona hasta ${this.currentGame.maxNumbers} números${this.currentGame.maxStars > 0 ? ' y ' + this.currentGame.maxStars + ' estrellas' : ''}</div>`;
    } else {
      // Main numbers
      Array.from(this.selectedNumbers).sort((a,b)=>a-b).forEach(num => {
        const ball = document.createElement('div');
        ball.classList.add('number-ball', 'selected');
        ball.style.cssText = 'width: 35px; height: 35px; cursor: default;';
        ball.textContent = String(num);
        display.appendChild(ball);
      });

      // Stars
      if (this.selectedStars.size > 0) {
        const separator = document.createElement('div');
        separator.style.cssText = 'margin: 0 10px; font-weight: bold; color: #666;';
        separator.textContent = '+';
        display.appendChild(separator);

        Array.from(this.selectedStars).sort((a,b)=>a-b).forEach(num => {
          const ball = document.createElement('div');
          ball.classList.add('number-ball', 'star-ball', 'selected');
          ball.style.cssText = 'width: 35px; height: 35px; cursor: default; background: #fbbf24; color: #000;';
          ball.textContent = String(num);
          display.appendChild(ball);
        });
      }
    }
  }

  updateTopDisplayWithCombination(combination: number[], type = 'generated', stars: number[] = []) {
    const display = document.getElementById('selectedDisplay');
    if (!display) return;
    display.innerHTML = '';
    if (!combination || combination.length === 0) {
        display.innerHTML = `<div style="color:#666; font-style: italic;">No se generó ninguna combinación.</div>`;
        return;
    }

    const className = type === 'random' ? 'random-pick' : 'generated-pick';

    combination.sort((a, b) => a - b).forEach(num => {
        const ball = document.createElement('div');
        ball.classList.add('number-ball', className);
        ball.style.cssText = 'width: 35px; height: 35px; cursor: default;';
        ball.textContent = String(num);
        display.appendChild(ball);
    });

    if (stars && stars.length > 0) {
        const separator = document.createElement('div');
        separator.style.cssText = 'margin: 0 10px; font-weight: bold; color: #666;';
        separator.textContent = '+';
        display.appendChild(separator);

        stars.sort((a, b) => a - b).forEach(num => {
            const ball = document.createElement('div');
            ball.classList.add('number-ball', 'star-ball', className);
            ball.style.cssText = 'width: 35px; height: 35px; cursor: default; background: #fbbf24; color: #000;';
            ball.textContent = String(num);
            display.appendChild(ball);
        });
    }
  }

  // ===== UI STRATEGY =====
  updateStrategyUI(strategy: string) {
    document.querySelectorAll('.strategy-buttons .strategy-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.strategy-buttons .strategy-btn[data-strategy="${strategy}"]`)?.classList.add('active');
    const winningOptions = document.getElementById('winningOptions') as HTMLElement;
    const multipleOptions = document.getElementById('multipleNumbersOptions') as HTMLElement;
    const generateBtn = document.getElementById('generateBtn');

    if(winningOptions) winningOptions.style.display = strategy === 'winning' ? 'block' : 'none';
    if(multipleOptions) multipleOptions.style.display = strategy === 'multiple' ? 'block' : 'none';
    
    if (generateBtn) {
        generateBtn.innerHTML = `<span>🤞 Generar Combinación</span>`;
    }
  }
  
  // ===========================================
  // ===== MOTOR DE GENERACIÓN (CORREGIDO) =====
  // ===========================================
  async generateCombinations() {
    if (this.isGenerating) return;
    
    this.clearUITrigger();
    this.showFilterSpinner();
    // Don't clear selections if in figure mode, as they ARE the universe
    if (this.currentSelectionMode !== 'figure') {
        this.clearSelections(false);
    }

    this.isGenerating = true;
    this.showLoading('Iniciando...');
    
    this.updateFilterStateFromUI();
    const availableUniverse = this.getAvailableUniverse('number');
    const availableStars = this.getAvailableUniverse('star');
    const maxNumbers = this.currentGame.maxNumbers;
    const maxStars = this.currentGame.maxStars;

    if (availableUniverse.length < maxNumbers) {
      this.showToast(`Imposible generar. Menos de ${maxNumbers} números disponibles con los filtros actuales.`, 'error');
      this.hideLoading();
      this.isGenerating = false;
      this.hideFilterSpinner();
      return;
    }

    let strategy = (document.querySelector('.strategy-buttons .strategy-btn.active') as HTMLElement)?.dataset.strategy;
    if (!strategy) {
        strategy = 'simple';
        this.updateStrategyUI('simple');
    }
    let combinations: number[][] = [];
    let starsCombinations: number[][] = [];

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      if (strategy === 'simple') {
          this.showLoading('Buscando combinación...');
          const loadingInfo = document.getElementById('loadingInfo');
          let found = false;
          const maxSimpleAttempts = 50000;
          const chunkSize = 1500;
          
          for (let i = 0; i < maxSimpleAttempts; i++) {
              if (i > 0 && i % chunkSize === 0) {
                  if (loadingInfo) {
                      loadingInfo.textContent = `Buscando... (${i} intentos probados)`;
                  }
                  // Yield execution to the browser event loop to avoid locking the UI thread
                  await new Promise(resolve => setTimeout(resolve, 1));
              }
              
              const combo = this.generateRandomCombination(availableUniverse, maxNumbers);
              const stars = maxStars > 0 ? this.generateRandomCombination(availableStars, maxStars) : [];
              if (this.isValidCombination(combo, stars)) {
                  combinations = [combo];
                  starsCombinations = [stars];
                  found = true;
                  break;
              }
          }
          if (!found) {
              throw new Error('No se encontró ninguna combinación que cumpla todos los filtros.');
          }
      } else if (strategy === 'winning') {
          const generateCount = parseInt((document.getElementById('generateCount') as HTMLInputElement)?.value || '100');
          const playCount = parseInt((document.getElementById('playCount') as HTMLInputElement)?.value || '10');
          const results = await this.findAndRankWinningCombinations(availableUniverse, generateCount, playCount);
          combinations = results.map(r => r.combo);
          starsCombinations = results.map(r => r.stars);
      } else if (strategy === 'multiple') {
          const numCount = parseInt((document.querySelector('.number-option.active') as HTMLElement)?.dataset.numbers || String(maxNumbers + 1));
          const starCount = this.currentGame.id === 'euromillones' ? 
              parseInt((document.querySelector('.star-multiple-option.active') as HTMLElement)?.dataset.stars || '2') : 
              maxStars;

          if (availableUniverse.length < numCount) {
              throw new Error(`No hay suficientes números (${availableUniverse.length}) para una múltiple de ${numCount}.`);
          }
          if (maxStars > 0 && availableStars.length < starCount) {
              throw new Error(`No hay suficientes estrellas (${availableStars.length}) para una múltiple de ${starCount}.`);
          }

          const result = await this.findValidSuperset(availableUniverse, numCount, starCount);
          if (result) {
              combinations = [result.superset];
              starsCombinations = [result.stars];
              this.lastMultipleStats = { validCount: result.validCount, totalCount: result.totalCount };
          }
      }

      if (combinations.length > 0) {
        this.displayTicket(combinations, strategy!, starsCombinations);
        
        // UI Trigger Logic
        let triggerMsg = '';
        let toastMsg = '';
        if (strategy === 'simple') {
            triggerMsg = 'Combinación inteligente encontrada!';
            toastMsg = '✅ Combinación inteligente encontrada!';
        } else if (strategy === 'winning') {
            const generateCount = (document.getElementById('generateCount') as HTMLInputElement)?.value || '100';
            const playCount = combinations.length;
            triggerMsg = `Generadas ${generateCount} combinaciones. Mostrando las ${playCount} mejores`;
            toastMsg = `✅ Generadas ${generateCount} combinaciones. Mostrando las ${playCount} mejores`;
        } else if (strategy === 'multiple' && this.lastMultipleStats) {
            const { validCount, totalCount } = this.lastMultipleStats;
            const percentage = ((validCount / totalCount) * 100).toFixed(1);
            triggerMsg = `Múltiple encontrada! ${validCount}/${totalCount} combinaciones internas cumplen los filtros (${percentage}%)`;
            toastMsg = `✅ Múltiple encontrada! ${validCount}/${totalCount} combinaciones internas cumplen los filtros (${percentage}%)`;
        }

        if (triggerMsg) {
            this.showToast(toastMsg, 'success');
            this.showUITrigger(triggerMsg);
        }
      } else {
         this.showToast('No se encontró ninguna combinación que cumpla todos los filtros. Prueba a flexibilizarlos.', 'warning');
         this.displayFilterFailureDiagnostics();
      }

    } catch (error: any) {
        this.showToast(`Error: ${error.message}`, 'error');
        if (error.message && error.message.includes('No se encontró ninguna combinación')) {
            try {
                this.displayFilterFailureDiagnostics();
            } catch (diagErr) {
                console.error("Fallo al mostrar el diagnóstico detallado:", diagErr);
            }
        }
    } finally {
        this.hideLoading();
        this.isGenerating = false;
        this.hideFilterSpinner();
        try {
            this.updateFilterBadgesFromAudit();
        } catch (badgeErr) {
            console.error("No se pudieron actualizar los visuales de filtros:", badgeErr);
        }
    }
  }


  async findAndRankWinningCombinations(universe: number[], generateCount: number, playCount: number): Promise<{combo: number[], stars: number[]}[]> {
    this.showLoading(`Buscando ${generateCount} válidas...`);
    const loadingInfo = document.getElementById('loadingInfo');

    const validPairs: {combo: number[], stars: number[]}[] = [];
    const maxNumbers = this.currentGame.maxNumbers;
    const maxStars = this.currentGame.maxStars;
    const availableStars = this.getAvailableUniverse('star');
    const maxAttempts = Math.max(500000, generateCount * 100);
    
    for(let i=0; i < maxAttempts && validPairs.length < generateCount; i++) {
        if (i % 500 === 0) {
            if (loadingInfo) loadingInfo.textContent = `${validPairs.length} / ${generateCount} encontradas... (Intento ${i})`;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        const combo = this.generateRandomCombination(universe, maxNumbers);
        const stars = maxStars > 0 ? this.generateRandomCombination(availableStars, maxStars) : [];
        if (this.isValidCombination(combo, stars)) {
            validPairs.push({combo, stars});
        }
    }

    if (validPairs.length === 0) {
        throw new Error('No se encontraron combinaciones válidas. Intenta flexibilizar los filtros.');
    }

    this.showLoading('Puntuando y ordenando...');
    if (loadingInfo) loadingInfo.textContent = `Puntuando ${validPairs.length} combinaciones...`;
    await new Promise(resolve => setTimeout(resolve, 0));

    const scoredPairs = validPairs.map(pair => ({
        pair,
        score: this.calculateCombinationScore(pair.combo, pair.stars)
    }));

    scoredPairs.sort((a, b) => b.score - a.score);
    return scoredPairs.slice(0, playCount).map(item => item.pair);
  }

  async findValidSuperset(universe: number[], numCount: number, starCount: number = 0): Promise<{ superset: number[], stars: number[], validCount: number, totalCount: number } | null> {
    const label = starCount > this.currentGame.maxStars ? `Múltiple de ${numCount} + ${starCount}⭐` : `Múltiple de ${numCount}`;
    this.showLoading(`Buscando ${label}...`);
    const loadingInfo = document.getElementById('loadingInfo');
    const maxNumbers = this.currentGame.maxNumbers;
    const maxStars = this.currentGame.maxStars;
    const availableStars = this.getAvailableUniverse('star');
    
    const tolerance = this.TOLERANCE_LEVELS[numCount] || 0.5;
    const maxAttempts = 50000;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (attempt % 100 === 0) {
            if(loadingInfo) loadingInfo.textContent = `Intento ${attempt} de ${maxAttempts}...`;
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const candidateSuperset = this.generateRandomCombination(universe, numCount);
        const subCombinations = this.getCombinations(candidateSuperset, maxNumbers);
        
        let candidateStarSuperset: number[] = [];
        let starSubCombinations: number[][] = [[]];

        if (maxStars > 0) {
            const actualStarCount = starCount || maxStars;
            candidateStarSuperset = this.generateRandomCombination(availableStars, actualStarCount);
            starSubCombinations = this.getCombinations(candidateStarSuperset, maxStars);
        }

        const totalSubCombos = subCombinations.length * starSubCombinations.length;
        const requiredValidCount = Math.ceil(totalSubCombos * tolerance);

        let validCount = 0;
        for (const subCombo of subCombinations) {
            for (const subStar of starSubCombinations) {
                if (this.isValidCombination(subCombo, subStar)) {
                    validCount++;
                }
            }
        }

        if (validCount >= requiredValidCount) {
            if(loadingInfo) loadingInfo.textContent = `¡Superconjunto válido encontrado!`;
            return { 
                superset: candidateSuperset.sort((a, b) => a - b),
                stars: candidateStarSuperset.sort((a, b) => a - b),
                validCount,
                totalCount: totalSubCombos
            };
        }
    }
    if(loadingInfo) loadingInfo.textContent = `Búsqueda finalizada sin éxito.`;
    return null;
  }

  findValidCombinations(universe: number[], count: number, maxAttempts: number): number[][] {
      const validCombinations: number[][] = [];
      const maxNumbers = this.currentGame.maxNumbers;
      for (let i = 0; i < maxAttempts && validCombinations.length < count; i++) {
          const combo = this.generateRandomCombination(universe, maxNumbers);
          if (this.isValidCombination(combo)) {
              validCombinations.push(combo);
          }
      }
      return validCombinations;
  }
  
  isValidCombination(combination: number[], stars: number[] = []): boolean {
      const maxNumbers = this.currentGame.maxNumbers;
      const maxStars = this.currentGame.maxStars;
      
      if (combination.length !== maxNumbers) return false;
      if (maxStars > 0 && stars.length !== maxStars) return false;

      // 1. SUM: extremely cheap to check
      let sum = 0;
      for (let i = 0; i < maxNumbers; i++) sum += combination[i];
      if (this.filters.sum) {
          if (sum < this.filters.sum.min || sum > this.filters.sum.max) return false;
      }

      // 2. TERMINACIONES DISTINTAS: very cheap, uses set map
      if (this.filters.terminacionesDistintas && this.filters.terminacionesDistintas.length > 0) {
          const uniqueEndings = new Set(combination.map(n => n % 10)).size;
          if (!this.filters.terminacionesDistintas.includes(uniqueEndings)) return false;
      }

      // 3. PAR IMPAR: very cheap, single-pass loop
      if (this.filters.parImpar && this.filters.parImpar.length > 0) {
          const evens = combination.filter(n => n % 2 === 0).length;
          const parImparKey = `${evens}/${maxNumbers - evens}`;
          if (!this.filters.parImpar.includes(parImparKey)) return false;
      }

      // 4. BAJOS ALTOS: very cheap, single-pass loop
      if (this.filters.bajosAltos && this.filters.bajosAltos.length > 0) {
          const midPoint = Math.floor(this.currentGame.numberRange / 2);
          const lows = combination.filter(n => n <= midPoint).length;
          const bajosAltosKey = `${lows}/${maxNumbers - lows}`;
          if (!this.filters.bajosAltos.includes(bajosAltosKey)) return false;
      }

      // 5. PRIMOS: cheap set lookups
      if (this.filters.primos) {
          const primesCount = combination.filter(n => this.primes.has(n)).length;
          if (primesCount < this.filters.primos.min || primesCount > this.filters.primos.max) return false;
      }

      // 6. DISTANCIA: cheap sequential checks
      if (this.filters.distancia) {
          const sortedCombo = [...combination].sort((a,b) => a-b);
          for (let i = 0; i < sortedCombo.length - 1; i++) {
              const diff = sortedCombo[i+1] - sortedCombo[i];
              if (diff < this.filters.distancia.min || diff > this.filters.distancia.max) return false;
          }
      }

      // 7. SUMA DÍGITOS: moderately cheap single-pass
      if (this.filters.sumaDigitos) {
          const digitSum = combination.reduce((sumVal, num) => sumVal + (num < 10 ? num : (num % 10 + Math.floor(num/10))), 0);
          if (digitSum < this.filters.sumaDigitos.min || digitSum > this.filters.sumaDigitos.max) return false;
      }

      // 8. CONSECUTIVOS: sorting and simple match
      if (this.filters.consecutivos && this.filters.consecutivos.length > 0) {
          const sorted = [...combination].sort((a,b)=>a-b);
          let consecutivePattern = '';
          let count = 1;
          for (let i = 1; i < sorted.length; i++) {
              if (sorted[i] === sorted[i-1] + 1) {
                  count++;
              } else {
                  consecutivePattern += count;
                  count = 1;
              }
          }
          consecutivePattern += count;
          const consecPatternSorted = consecutivePattern.split('').sort((a,b)=>Number(b)-Number(a)).join('/');
          if (!this.filters.consecutivos.includes(consecPatternSorted)) return false;
      }

      // 9. AGRUPAMIENTO DECENAS: decade groupings
      if (this.filters.agrupDecenas && this.filters.agrupDecenas.length > 0) {
          const tens: { [key: number]: number } = {};
          combination.forEach(n => {
              const ten = Math.floor((n-1)/10);
              tens[ten] = (tens[ten] || 0) + 1;
          });
          const tensGroups = Object.values(tens).sort((a,b)=>b-a).join('/');
          if (!this.filters.agrupDecenas.includes(tensGroups)) return false;
      }

      // 10. DESVIACIÓN ESTÁNDAR: computationally heavier
      if (this.filters.desviacion) {
          const mean = sum / maxNumbers;
          const stdDev = Math.sqrt(combination.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / maxNumbers);
          if (stdDev < this.filters.desviacion.min || stdDev > this.filters.desviacion.max) return false;
      }

      // 11. ENTROPÍA DE TERMINACIONES (SHANNON)
      if (this.filters.entropyTerminaciones) {
          const endingCounts: { [key: number]: number } = {};
          combination.forEach(n => {
              const ending = n % 10;
              endingCounts[ending] = (endingCounts[ending] || 0) + 1;
          });
          const entropyTerm = -Object.values(endingCounts).reduce((s, countVal) => {
              const p = countVal / maxNumbers;
              return s + p * Math.log2(p);
          }, 0);
          if (entropyTerm < this.filters.entropyTerminaciones.min || entropyTerm > this.filters.entropyTerminaciones.max) return false;
      }

      // 11.5. ENTROPÍA DE INTERVALOS (SHANNON)
      if (this.filters.entropyIntervalos) {
          const sortedCombo = [...combination].sort((a,b) => a-b);
          const intervalCounts: { [key: number]: number } = {};
          for (let idx = 0; idx < sortedCombo.length - 1; idx++) {
              const diff = sortedCombo[idx+1] - sortedCombo[idx];
              intervalCounts[diff] = (intervalCounts[diff] || 0) + 1;
          }
          const numIntervals = maxNumbers - 1;
          const entropyInt = -Object.values(intervalCounts).reduce((s, countVal) => {
              const p = countVal / numIntervals;
              return s + p * Math.log2(p);
          }, 0);
          if (entropyInt < this.filters.entropyIntervalos.min || entropyInt > this.filters.entropyIntervalos.max) return false;
      }

      // 12. GEOMÉTRICOS: grid loops
      if (this.filters.geometric) {
          if (this.filters.geometric.exclude && this.filters.geometric.exclude.length > 0) {
              if (this.hasGeometricPattern(combination, this.filters.geometric.exclude)) return false;
          }
          if (this.filters.geometric.favor && this.filters.geometric.favor.includes('espaciados')) {
              if (!this.isSpaced(combination)) return false;
          }
      }

      // 13. ESTRELLAS: checked in similar lazy order
      if (maxStars > 1 && stars.length === maxStars) {
          const starSum = stars.reduce((a, b) => a + b, 0);
          if (this.filters.starSum) {
              if (starSum < this.filters.starSum.min || starSum > this.filters.starSum.max) return false;
          }

          if (this.filters.starParImpar && this.filters.starParImpar.length > 0) {
              const starEvens = stars.filter(n => n % 2 === 0).length;
              const starParImparKey = `${starEvens}/${maxStars-starEvens}`;
              if (!this.filters.starParImpar.includes(starParImparKey)) return false;
          }

          if (this.filters.starBajosAltos && this.filters.starBajosAltos.length > 0) {
              const starMid = Math.floor(this.currentGame.starRange / 2);
              const starLows = stars.filter(n => n <= starMid).length;
              const starBajosAltosKey = `${starLows}/${maxStars-starLows}`;
              if (!this.filters.starBajosAltos.includes(starBajosAltosKey)) return false;
          }

          if (this.filters.starSumaDigitos) {
              let starDigitSum = 0;
              stars.forEach(s => {
                  const sStr = s.toString();
                  for (let i = 0; i < sStr.length; i++) starDigitSum += parseInt(sStr[i]);
              });
              if (starDigitSum < this.filters.starSumaDigitos.min || starDigitSum > this.filters.starSumaDigitos.max) return false;
          }

          if (this.filters.starPrimos) {
              const starPrimosCount = stars.filter(n => this.primes.has(n)).length;
              if (starPrimosCount < this.filters.starPrimos.min || starPrimosCount > this.filters.starPrimos.max) return false;
          }

          if (this.filters.starConsecutivos && this.filters.starConsecutivos.length > 0) {
              const sortedStars = [...stars].sort((a,b)=>a-b);
              let starConsecPattern = '';
              let sCount = 1;
              for (let i = 1; i < sortedStars.length; i++) {
                  if (sortedStars[i] === sortedStars[i-1] + 1) {
                      sCount++;
                  } else {
                      starConsecPattern += sCount;
                      sCount = 1;
                  }
              }
              starConsecPattern += sCount;
              const starConsecPatternSorted = starConsecPattern.split('').sort((a,b)=>Number(b)-Number(a)).join('/');
              if (!this.filters.starConsecutivos.includes(starConsecPatternSorted)) return false;
          }

          if (this.filters.starDistancia) {
              const sortedStars = [...stars].sort((a,b)=>a-b);
              let minStarDist = 99;
              for (let i = 0; i < sortedStars.length - 1; i++) {
                  const d = sortedStars[i+1] - sortedStars[i];
                  if (d < minStarDist) minStarDist = d;
              }
              if (minStarDist < this.filters.starDistancia.min || minStarDist > this.filters.starDistancia.max) return false;
          }
      }

      return true;
  }

  generateRandomCombination(universe: number[], count: number): number[] {
    let tempUniverse = [...universe];
    let combination: number[] = [];
    while (combination.length < count && tempUniverse.length > 0) {
      const randomIndex = Math.floor(Math.random() * tempUniverse.length);
      combination.push(tempUniverse.splice(randomIndex, 1)[0]);
    }
    return combination.sort((a, b) => a - b);
  }
  
  // FIX: Added strong types to function signature and internals.
  getCombinations(source: number[], k: number): number[][] {
    if (k > source.length || k <= 0) return [];
    if (k === source.length) return [source];
    if (k === 1) return source.map(item => [item]);

    const result: number[][] = [];
    const stack: [number, number[]][] = [[0, []]];
    while (stack.length > 0) {
        const [index, currentCombo] = stack.pop()!;

        if (currentCombo.length === k) {
            result.push(currentCombo);
            continue;
        }
        if (index >= source.length) continue;

        stack.push([index + 1, currentCombo]);
        stack.push([index + 1, [...currentCombo, source[index]]]);
    }
    return result;
  }
  
  // ===== ESTADÍSTICAS Y VALIDACIÓN (CORREGIDO) =====
  updateStats() {
    this.displayCombinationStats(Array.from(this.selectedNumbers), Array.from(this.selectedStars));
  }

  displayCombinationStats(combination: number[], stars: number[] = []) {
    const statsContent = document.getElementById('statsContent');
    if (!statsContent) return;
    
    const safeSetText = (id: string, text: string | number) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(text);
    };
    
    const maxNumbers = this.currentGame.maxNumbers;
    if (!combination || combination.length !== maxNumbers) {
        statsContent.querySelectorAll('.stat-value').forEach(el => el.textContent = '-');
        return;
    }
    const stats = this.getCombinationStats(combination, stars);
    for (const key in stats) {
        if (key.startsWith('_')) continue; // No mostrar valores raw
        const elId = `stat${key.charAt(0).toUpperCase() + key.slice(1)}`;
        // FIX: Cast stats[key] to any to satisfy safeSetText. The types are compatible.
        safeSetText(elId, (stats as any)[key]);
    }
  }

  getCombinationStats(combination: number[], stars: number[] = []) {
    const maxNumbers = this.currentGame.maxNumbers;
    if (combination.length !== maxNumbers) return {};
    
    const sum = combination.reduce((a, b) => a + b, 0);
    const evens = combination.filter(n => n % 2 === 0).length;
    const midPoint = Math.floor(this.currentGame.numberRange / 2);
    const lows = combination.filter(n => n <= midPoint).length;
    const primesCount = combination.filter(n => this.primes.has(n)).length;
    
    const sorted = [...combination].sort((a,b)=>a-b);
    let consecutivePattern = '';
    let count = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i-1] + 1) {
            count++;
        } else {
            consecutivePattern += count;
            count = 1;
        }
    }
    consecutivePattern += count;
    const consecPatternSorted = consecutivePattern.split('').sort((a,b)=>Number(b)-Number(a)).join('/');
    
    const tens: { [key: number]: number } = {};
    combination.forEach(n => {
        const ten = Math.floor((n-1)/10);
        tens[ten] = (tens[ten] || 0) + 1;
    });
    const tensGroups = Object.values(tens).sort((a,b)=>b-a).join('/');

    const digitSum = combination.reduce((sum, num) => sum + (num < 10 ? num : (num % 10 + Math.floor(num/10))), 0);
    
    const mean = sum / maxNumbers;
    const stdDev = Math.sqrt(combination.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / maxNumbers);

    // Entropía de Terminaciones (Shannon)
    const endingCounts: { [key: number]: number } = {};
    combination.forEach(n => {
        const ending = n % 10;
        endingCounts[ending] = (endingCounts[ending] || 0) + 1;
    });
    const entropyTerm = -Object.values(endingCounts).reduce((s, countVal) => {
        const p = countVal / maxNumbers;
        return s + p * Math.log2(p);
    }, 0);

    // Entropía de Intervalos (Shannon)
    const intervalCounts: { [key: number]: number } = {};
    for (let idx = 0; idx < sorted.length - 1; idx++) {
        const diff = sorted[idx+1] - sorted[idx];
        intervalCounts[diff] = (intervalCounts[diff] || 0) + 1;
    }
    const numIntervals = maxNumbers - 1;
    const entropyInt = -Object.values(intervalCounts).reduce((s, countVal) => {
        const p = countVal / numIntervals;
        return s + p * Math.log2(p);
    }, 0);

    let stats: any = {
      suma: sum,
      parImpar: `${evens}/${maxNumbers-evens}`,
      bajosAltos: `${lows}/${maxNumbers-lows}`,
      primos: primesCount,
      consecutivos: consecPatternSorted,
      agrupDecenas: tensGroups,
      sumaDigitos: digitSum,
      desviacion: stdDev.toFixed(2),
      entropiaTerminaciones: entropyTerm.toFixed(3),
      entropiaIntervalos: entropyInt.toFixed(3),
      _desviacion: stdDev,
      _entropiaTerminaciones: entropyTerm,
      _entropiaIntervalos: entropyInt,
    };

    if (stars.length > 0) {
        const starSum = stars.reduce((a, b) => a + b, 0);
        const starEvens = stars.filter(n => n % 2 === 0).length;
        const starMid = Math.floor(this.currentGame.starRange / 2);
        const starLows = stars.filter(n => n <= starMid).length;
        const starPrimos = stars.filter(n => this.primes.has(n)).length;
        
        const sortedStars = [...stars].sort((a,b)=>a-b);
        let starConsecPattern = '';
        let sCount = 1;
        for (let i = 1; i < sortedStars.length; i++) {
            if (sortedStars[i] === sortedStars[i-1] + 1) {
                sCount++;
            } else {
                starConsecPattern += sCount;
                sCount = 1;
            }
        }
        starConsecPattern += sCount;
        const starConsecPatternSorted = starConsecPattern.split('').sort((a,b)=>Number(b)-Number(a)).join('/');

        let minStarDist = 99;
        for (let i = 0; i < sortedStars.length - 1; i++) {
            const d = sortedStars[i+1] - sortedStars[i];
            if (d < minStarDist) minStarDist = d;
        }
        
        let starDigitSum = 0;
        stars.forEach(s => {
            const sStr = s.toString();
            for (let i = 0; i < sStr.length; i++) starDigitSum += parseInt(sStr[i]);
        });

        stats.estrellas = {
            suma: starSum,
            parImpar: `${starEvens}/${stars.length - starEvens}`,
            bajosAltos: `${starLows}/${stars.length - starLows}`,
            sumaDigitos: starDigitSum,
            primos: starPrimos,
            consecutivos: starConsecPatternSorted,
            distancia: minStarDist === 99 ? 0 : minStarDist
        };
    }

    return stats;
  }
  
  clearGridHighlights() {
    document.querySelectorAll('.number-ball.generated-pick, .number-ball.random-pick').forEach(ball => {
        ball.classList.remove('generated-pick', 'random-pick');
        // Restore persistent icons/states
        this.updateGridNumberStates(); 
    });
  }
  
  // ===== TICKET & STORAGE =====
  displayTicket(combinations: number[][], strategy: string, starsCombinations: number[][] = []) {
    let finalCombinations = combinations;
    
    // YA NO EXPLOTAMOS AQUÍ LA MÚLTIPLE.
    // La dejamos tal cual para que se muestre como un bloque.
    // La validación se encargará de explotarla.

    this.currentTicket = { 
        date: new Date().toISOString(), 
        combinations: finalCombinations, 
        strategy,
        gameId: this.currentGame.id, // NEW: Store game ID
        stars: starsCombinations.length > 0 ? starsCombinations : undefined
    };

    const ticketDiv = document.getElementById('ticket');
    if (!ticketDiv) return;

    if (ticketDiv.classList.contains('conflict')) {
        ticketDiv.classList.remove('conflict');
        ticketDiv.innerHTML = `
          <div class="ticket-header">
            <h4>🎫 Tu Boleto Ganador</h4>
            <p id="ticketDate"></p>
          </div>
          <div class="ticket-draw-date-selector">
              <label>Fecha del Sorteo (Opcional):</label>
              <input type="date" id="ticketDrawDate">
          </div>
          <div id="ticketCombinations"></div>
          <div class="ticket-actions">
            <button class="ticket-btn save-btn" id="saveBtn">
              💾 Guardar Boleto
            </button>
            <button class="ticket-btn share-btn" id="shareBtn">
              📤 Compartir
            </button>
          </div>
        `;
        
        // Re-attach listeners to the reconstructed buttons
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveTicket());
        document.getElementById('shareBtn')?.addEventListener('click', () => this.shareTicket());
    }

    const combinationsDiv = document.getElementById('ticketCombinations');
    const ticketDateEl = document.getElementById('ticketDate');
    if (ticketDateEl) ticketDateEl.textContent = new Date().toLocaleString();
    
    if (!combinationsDiv) return;
    combinationsDiv.innerHTML = '';
    
    finalCombinations.forEach((combo, idx) => {
        const comboDiv = document.createElement('div');
        const maxNumbers = this.currentGame.maxNumbers;
        const isSystem = combo.length > maxNumbers;
        
        comboDiv.className = `ticket-combination ${isSystem ? 'system' : ''}`;
        
        if (isSystem) {
            const badge = document.createElement('div');
            badge.className = 'system-badge';
            badge.textContent = `Múltiple de ${combo.length} Números`;
            comboDiv.appendChild(badge);
        }

        const numbersContainer = document.createElement('div');
        numbersContainer.style.display = 'flex';
        numbersContainer.style.flexWrap = 'wrap';
        numbersContainer.style.gap = '8px';
        numbersContainer.style.alignItems = 'center';
        numbersContainer.style.justifyContent = isSystem ? 'center' : 'flex-start';

        combo.sort((a,b)=>a-b).forEach(num => {
            const numDiv = document.createElement('div');
            numDiv.className = 'ticket-number';
            numDiv.textContent = String(num);
            numbersContainer.appendChild(numDiv);
        });

        if (starsCombinations[idx] && starsCombinations[idx].length > 0) {
            const separator = document.createElement('div');
            separator.style.color = '#9ca3af';
            separator.style.fontWeight = 'bold';
            separator.style.margin = '0 4px';
            separator.textContent = '+';
            numbersContainer.appendChild(separator);

            starsCombinations[idx].sort((a,b)=>a-b).forEach(num => {
                const starDiv = document.createElement('div');
                starDiv.className = 'ticket-number star';
                starDiv.style.background = '#fbbf24';
                starDiv.style.color = '#000';
                starDiv.textContent = String(num);
                numbersContainer.appendChild(starDiv);
            });
        }

        comboDiv.appendChild(numbersContainer);
        combinationsDiv.appendChild(comboDiv);
    });
    
    this.clearGridHighlights();

    if (strategy !== 'multiple' && finalCombinations.length > 0) {
        this.updateTopDisplayWithCombination(finalCombinations[0], 'generated');
    } else if (strategy === 'multiple') {
        // Mostrar el superset generado en el display superior también
        if (finalCombinations.length > 0) {
             this.updateTopDisplayWithCombination(finalCombinations[0], 'generated');
        }
    } else {
        const display = document.getElementById('selectedDisplay');
        const message = strategy === 'multiple' ? 'Múltiple generada. Ver boleto.' : 'Selecciona hasta 6 números';
        if(display) display.innerHTML = `<div style="color:#666; font-style: italic;">${message}</div>`;
    }

    // Highlight picks
    if (finalCombinations.length > 0) {
        // If it's multiple, the first combination IS the superset.
        finalCombinations[0].forEach(num => {
            const ball = document.querySelector(`.number-ball[data-number="${num}"]`);
            if (ball) {
                ball.classList.add('generated-pick');
                const icon = ball.querySelector('.number-icon');
                if(icon) icon.textContent = '🤖';
            }
        });
        
        if (strategy === 'multiple') {
             // Highlight stars if any
             if (starsCombinations.length > 0) {
                 starsCombinations[0].forEach(star => {
                     const ball = document.querySelector(`.number-ball.star-ball[data-number="${star}"]`);
                     if (ball) {
                         ball.classList.add('generated-pick');
                         const icon = ball.querySelector('.number-icon');
                         if(icon) icon.textContent = '⭐';
                     }
                 });
             }
             // No stats for superset
             this.displayCombinationStats([]);
        } else {
            this.displayCombinationStats(finalCombinations[0]);
        }
    }
    
    ticketDiv.classList.add('show');
    // Scroll to ticket with safety delay and mobile optimization
    setTimeout(() => {
        try {
            ticketDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) {
            ticketDiv.scrollIntoView();
        }
    }, 150);
  }
  saveTicket() {
    if (!this.currentTicket) return;

    const drawDateEl = document.getElementById('ticketDrawDate') as HTMLInputElement;
    if (drawDateEl && drawDateEl.value) {
      this.currentTicket.drawDate = drawDateEl.value;
    }

    this.savedTickets.unshift(this.currentTicket);
    this.saveState();
    this.updateSavedTickets();
    this.currentTicket = null;
    const ticketDiv = document.getElementById('ticket');
    if(ticketDiv) ticketDiv.classList.remove('show');
    this.showToast('✅ Boleto guardado', 'success');
  }

  deleteTicket(date: string) {
    this.savedTickets = this.savedTickets.filter(t => t.date !== date);
    this.saveState();
    this.updateSavedTickets();
    this.showToast('Boleto eliminado', 'info');
  }

  updateSavedTicketsStats() {
    const statsSection = document.getElementById('savedTicketsStatsSection') as HTMLElement;
    if (!statsSection) return;

    if (this.savedTickets.length === 0) {
        statsSection.style.display = 'none';
        return;
    }

    statsSection.style.display = 'block';

    const safeSetText = (id: string, text: string | number) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = String(text); // Use innerHTML to render styled text
    };

    // Calculate total combinations
    let totalCombinations = 0;
    this.savedTickets.forEach(ticket => {
        if (ticket.strategy === 'multiple' && ticket.combinations[0].length > 6) {
             // Calculate how many 6-number combos are in this multiple ticket
             const n = ticket.combinations[0].length;
             // nCr formula: n! / (r! * (n-r)!) where r=6
             let combos = 1;
             for(let i=0; i<6; i++) combos *= (n-i)/(i+1);
             totalCombinations += Math.round(combos);
        } else {
            totalCombinations += ticket.combinations.length;
        }
    });
    safeSetText('totalTicketsSaved', totalCombinations);

    // Strategy Distribution
    const strategyCounts: { [key: string]: number } = { simple: 0, winning: 0, multiple: 0 };
    const strategyMap: { [key: string]: string } = { simple: 'Simple', winning: 'E. Ganadora', multiple: 'Múltiple' };
    
    this.savedTickets.forEach(ticket => {
      if (strategyCounts.hasOwnProperty(ticket.strategy)) {
        strategyCounts[ticket.strategy] += ticket.combinations.length;
      } else {
        strategyCounts[ticket.strategy] = ticket.combinations.length;
      }
    });

    const mostUsed = Object.entries(strategyCounts).sort((a, b) => b[1] - a[1])[0];
    safeSetText('mostUsedStrategy', mostUsed && mostUsed[1] > 0 ? `${strategyMap[mostUsed[0]] || mostUsed[0]} (${mostUsed[1]})` : 'N/A');
    
    safeSetText('strategyDistribution', Object.entries(strategyCounts)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => `${strategyMap[key] || key}: ${value}`)
      .join(' | '));

    // Hit analysis
    // Note: For simplicity in this overview statistic, we won't explode multiples here unless already validated.
    const validatedTickets = this.savedTickets.filter(t => t.validation);
    const PROBS: { [key: number]: number } = { 3: 0.0176504, 4: 0.0009686, 5: 0.0000184, 6: 0.0000000715 };
    const hitCounts: { [key: number]: number } = { 3: 0, 4: 0, 5: 0, 6: 0 };
    let totalValidatedCombos = 0;

    validatedTickets.forEach(ticket => {
        // Handle Multiple specially if it has summary data
        if (ticket.strategy === 'multiple' && ticket.combinations[0].length > 6) {
             // To properly count hits in stats, we'd need to store the summary breakdown in the ticket validation object.
             // Currently `validation.hits` stores matches against the superset.
             // For this general stat display, we might skip detailed math for multiples to avoid complexity overflow here,
             // or simply check if `hits` > 6, which means it's a raw match count, not a combo result.
             // Let's skip multiples in this aggregate stats for now to keep it accurate for standard tickets.
        } else {
            totalValidatedCombos += ticket.combinations.length;
            ticket.validation!.hits.forEach(hitCount => {
                if (hitCounts.hasOwnProperty(hitCount)) {
                    hitCounts[hitCount]++;
                }
            });
        }
    });

    if (totalValidatedCombos > 0) {
        Object.keys(PROBS).forEach(tierStr => {
            const tier = parseInt(tierStr);
            const count = hitCounts[tier];
            const userRate = count / totalValidatedCombos;
            const statRate = (PROBS as any)[tier];
            
            let colorStyle = '';
            let performanceIndicator = '';

            if (userRate > statRate) {
                colorStyle = 'style="color: #166534;"'; // dark green
                performanceIndicator = '👍';
            } else if (userRate > 0 && userRate < statRate) {
                colorStyle = 'style="color: #991b1b;"'; // dark red
                performanceIndicator = '👎';
            }

            const userRatePercent = (userRate * 100).toFixed(4);
            const statRatePercent = (statRate * 100).toFixed(4);

            const text = `<span ${colorStyle}>${count} <small>(${userRatePercent}%)</small></span> <small>vs. ${statRatePercent}%</small> ${performanceIndicator}`;
            safeSetText(`hits${tier}`, text);
        });
    } else {
        safeSetText('hits3', 'N/A');
        safeSetText('hits4', 'N/A');
        safeSetText('hits5', 'N/A');
        safeSetText('hits6', 'N/A');
    }
}


  updateSavedTickets() {
    this.updateSavedTicketsStats();
    const container = document.getElementById('savedTickets');
    if (!container) return;
    container.innerHTML = '';
    if (this.savedTickets.length === 0) {
      container.innerHTML = '<div style="color:#666; text-align: center; padding: 20px;">No tienes boletos guardados</div>';
      return;
    }

    const filterSelect = document.getElementById('savedTicketsGameFilter') as HTMLSelectElement;
    const filterVal = filterSelect ? filterSelect.value : 'all';

    const filteredTickets = filterVal === 'all'
      ? this.savedTickets
      : this.savedTickets.filter(t => t.gameId === filterVal);

    if (filteredTickets.length === 0) {
      container.innerHTML = '<div style="color:#666; text-align: center; padding: 20px;">No tienes boletos guardados para este juego</div>';
      return;
    }

    const strategyMap: { [key: string]: string } = {
        simple: 'Simple',
        winning: 'E. Ganadora',
        multiple: 'Múltiple'
    };

    filteredTickets.forEach(ticket => {
      const item = document.createElement('div');
      item.className = 'saved-ticket-item';
      const strategyName = strategyMap[ticket.strategy] || ticket.strategy;
      const gameName = ticket.gameId && GAMES[ticket.gameId] ? GAMES[ticket.gameId].name : 'DataLotto 6/49';
      const strategyHTML = `<span class="saved-ticket-strategy">${strategyName}</span> <span class="saved-ticket-game" style="font-size: 0.75rem; color: #6b7280; margin-left: 5px;">(${gameName})</span>`;
      const drawDateHTML = ticket.drawDate ? `<span class="saved-ticket-draw-date">Sorteo: ${new Date(ticket.drawDate + 'T00:00:00').toLocaleDateString()}</span>` : '';

      let combosHTML = '';
      let actionsHTML = '';
      const playOnlineHTML = `<button class="play-online-btn-saved">🔗 Jugar Online</button>`;

      // Check if it's a system ticket (Multiple with > 6 numbers)
      const isSystemTicket = ticket.combinations.length > 0 && ticket.combinations[0].length > 6;

      if (isSystemTicket) {
          // === VISUALIZACIÓN MÚLTIPLE ===
          const superset = ticket.combinations[0];
          let summaryTableHTML = '';
          let validationClass = '';
          let validationStatusBtn = `<button class="validate">Validar</button>`;
          let supersetDisplayClass = '';

          if (ticket.validation) {
             const winningNumbersSet = new Set(ticket.validation.winningNumbers);
             validationClass = 'verified';
             validationStatusBtn = `<button class="validate verified" disabled>Verificado</button>`;

             // Generate breakdown summary
             const explodedCombos = this.getCombinations(superset, 6);
             const breakdown = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
             explodedCombos.forEach(c => {
                 const hits = c.filter(n => winningNumbersSet.has(n)).length;
                 (breakdown as any)[hits]++;
             });
             
             const totalMatchesInSuperset = superset.filter(n => winningNumbersSet.has(n)).length;
             
             summaryTableHTML = `
                <div style="margin-top: 10px; font-weight: bold; color: var(--primary);">
                    🎯 ${totalMatchesInSuperset} aciertos sobre los ${superset.length} números seleccionados.
                </div>
                <table class="validation-summary-table">
                    <tr>
                        <th>Aciertos</th>
                        <th>Cantidad</th>
                    </tr>
                    <tr class="${breakdown[6] > 0 ? 'row-highlight' : ''}"><td>6 Aciertos</td><td>${breakdown[6]}</td></tr>
                    <tr class="${breakdown[5] > 0 ? 'row-highlight' : ''}"><td>5 Aciertos</td><td>${breakdown[5]}</td></tr>
                    <tr class="${breakdown[4] > 0 ? 'row-highlight' : ''}"><td>4 Aciertos</td><td>${breakdown[4]}</td></tr>
                    <tr class="${breakdown[3] > 0 ? 'row-highlight' : ''}"><td>3 Aciertos</td><td>${breakdown[3]}</td></tr>
                     <tr><td>0-2 Aciertos</td><td>${breakdown[0]+breakdown[1]+breakdown[2]}</td></tr>
                </table>
             `;
             
             // Highlight matching balls in the main display
             combosHTML = `
                <div class="system-badge">Múltiple de ${superset.length} - ${explodedCombos.length} apuestas</div>
                <div class="saved-combination" style="flex-wrap: wrap; justify-content: center;">
                    <div class="saved-combination-content" style="flex-wrap: wrap; justify-content: center;">
                        ${superset.map(n => `<div class="saved-combination-number ${winningNumbersSet.has(n) ? 'selected' : ''}">${n}</div>`).join('')}
                    </div>
                </div>
                ${summaryTableHTML}
             `;

          } else {
             // Not validated yet
              combosHTML = `
                <div class="system-badge">Múltiple de ${superset.length}</div>
                <div class="saved-combination" style="flex-wrap: wrap; justify-content: center;">
                    <div class="saved-combination-content" style="flex-wrap: wrap; justify-content: center;">
                        ${superset.map(n => `<div class="saved-combination-number">${n}</div>`).join('')}
                    </div>
                </div>
             `;
          }
          
          actionsHTML = `${playOnlineHTML}${validationStatusBtn}`;

      } else {
          // === VISUALIZACIÓN ESTÁNDAR (SIMPLE / GANADORA) ===
          if (ticket.validation) {
            const winningNumbersSet = new Set(ticket.validation.winningNumbers);
            const winningStarsSet = new Set(ticket.validation.stars || []);
            
            combosHTML = ticket.combinations.map((combo, index) => {
                const hits = ticket.validation!.hits[index];
                const starHits = ticket.validation!.starHits ? ticket.validation!.starHits[index] : 0;
                const hitClass = hits >= 3 ? 'high-hits' : hits > 0 ? 'low-hits' : 'no-hits';
                
                let comboHTML = combo.map(n => `<div class="saved-combination-number ${winningNumbersSet.has(n) ? 'selected' : ''}">${n}</div>`).join('');
                
                if (ticket.stars && ticket.stars[index] && ticket.stars[index].length > 0) {
                    comboHTML += `<span style="margin: 0 4px; color: #9ca3af; font-weight: bold;">+</span>`;
                    comboHTML += ticket.stars[index].map(n => `<div class="saved-combination-number ${winningStarsSet.has(n) ? 'selected' : ''}" style="background: ${winningStarsSet.has(n) ? 'linear-gradient(135deg, #ffd700, #ffa000)' : '#fbbf24'}; color: #000;">${n}</div>`).join('');
                }

                const starHitsText = starHits > 0 ? ` + ${starHits}⭐` : '';
                return `<div class="saved-combination">
                            <div class="saved-combination-content">${comboHTML}</div>
                            <div class="hit-count ${hitClass}">${hits}${starHitsText} aciertos</div>
                        </div>`;
            }).join('');
            actionsHTML = `${playOnlineHTML}<button class="validate verified" disabled>Verificado</button>`;
          } else {
            combosHTML = ticket.combinations.map((combo, index) => {
                let comboHTML = combo.map(n => `<div class="saved-combination-number">${n}</div>`).join('');
                if (ticket.stars && ticket.stars[index] && ticket.stars[index].length > 0) {
                    comboHTML += `<span style="margin: 0 4px; color: #9ca3af; font-weight: bold;">+</span>`;
                    comboHTML += ticket.stars[index].map(n => `<div class="saved-combination-number" style="background: #fbbf24; color: #000;">${n}</div>`).join('');
                }
                return `<div class="saved-combination"><div class="saved-combination-content">${comboHTML}</div></div>`;
            }).join('');
            actionsHTML = `${playOnlineHTML}<button class="validate">Validar</button>`;
          }
      }
      
      item.innerHTML = `
        <div class="saved-ticket-header">
            <div>
              <span class="saved-ticket-date">${new Date(ticket.date).toLocaleString()}</span>
              ${drawDateHTML}
            </div>
            <div class="saved-ticket-actions">
              ${actionsHTML}
              <button class="delete-btn">X</button>
              <button class="toggle-btn">+</button>
            </div>
        </div>
        <div class="saved-ticket-details">
            ${strategyHTML}
        </div>
        <div class="saved-combinations">${combosHTML}</div>`;
      
      item.querySelector('.delete-btn')?.addEventListener('click', () => this.deleteTicket(ticket.date));
      item.querySelector('.play-online-btn-saved')?.addEventListener('click', () => this.playTicketOnline(ticket));
      const validateBtn = item.querySelector('.validate:not(.verified)');
      if(validateBtn) {
          validateBtn.addEventListener('click', () => this.startValidation(ticket.date));
      }
      item.querySelector('.toggle-btn')?.addEventListener('click', (e) => {
          const comboDiv = item.querySelector('.saved-combinations') as HTMLElement;
          const target = e.target as HTMLElement;
          if (!comboDiv || !target) return;
          const isVisible = comboDiv.style.display === 'block';
          comboDiv.style.display = isVisible ? 'none' : 'block';
          target.textContent = isVisible ? '+' : '-';
      });
      container.appendChild(item);
    });
  }

  autoValidateSavedTickets() {
    if (!this.historicalData || this.historicalData.length === 0) return;

    let validatedCount = 0;
    const historicalDrawsByDate: { [key: string]: { numbers: number[], stars?: number[] } } = {};
    this.historicalData.forEach(draw => {
        const drawDateStr = new Date(draw.date.getTime() - (draw.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        historicalDrawsByDate[drawDateStr] = { numbers: draw.numbers, stars: draw.stars };
    });

    this.savedTickets.forEach(ticket => {
        if (ticket.validation) return; 

        // Compatibility check: Only validate tickets from the current game
        if (ticket.gameId && ticket.gameId !== this.currentGame.id) return;

        let winningData: { numbers: number[], stars?: number[] } | null = null;

        if (ticket.drawDate) {
            if (historicalDrawsByDate[ticket.drawDate]) {
                winningData = historicalDrawsByDate[ticket.drawDate];
            }
        } else {
            const ticketCreationDate = new Date(ticket.date);
            const sortedDrawDates = Object.keys(historicalDrawsByDate).sort();
            const matchingDrawDateStr = sortedDrawDates.find(drawDateStr => {
                const drawDate = new Date(drawDateStr + 'T00:00:00');
                return drawDate >= ticketCreationDate;
            });
            
            if (matchingDrawDateStr) {
                winningData = historicalDrawsByDate[matchingDrawDateStr];
            }
        }

        if (winningData) {
            const winningNumbers = winningData.numbers;
            const winningStars = winningData.stars || [];
            
            const hits = ticket.combinations.map(combo =>
                combo.filter(n => winningNumbers.includes(n)).length
            );
            
            let starHits: number[] | undefined = undefined;
            if (ticket.stars) {
                starHits = ticket.stars.map(stars =>
                    stars.filter(n => winningStars.includes(n)).length
                );
            }

            ticket.validation = {
                winningNumbers,
                stars: winningStars.length > 0 ? winningStars : undefined,
                hits,
                starHits
            };
            validatedCount++;
        }
    });

    if (validatedCount > 0) {
        this.saveState();
        this.updateSavedTickets();
        this.showToast(`✅ ${validatedCount} boleto(s) han sido validados automáticamente.`, 'success');
    }
}

  startValidation(date: string) {
    this.currentValidatingTicket = this.savedTickets.find(t => t.date === date) || null;
    if (!this.currentValidatingTicket) return;
    
    const winningStarsInputSection = document.getElementById('winningStarsInputSection');
    const winningStarsLabel = document.getElementById('winningStarsLabel');
    const winningStarsInput = document.getElementById('winningStarsInput') as HTMLInputElement;
    
    if (winningStarsInputSection) {
        const gameId = this.currentValidatingTicket.gameId || 'bonoloto';
        const game = GAMES[gameId];
        const maxStars = game?.maxStars || 0;
        
        if (maxStars > 0) {
            winningStarsInputSection.style.display = 'block';
            if (winningStarsLabel && winningStarsInput) {
                if (gameId === 'gordo') {
                    winningStarsLabel.innerHTML = '🔑 Introduce el Número Clave ganador (0-9):';
                    winningStarsInput.placeholder = 'Por ejemplo: 5';
                } else if (gameId === 'eurodreams') {
                    winningStarsLabel.innerHTML = '🌙 Introduce el Sueño ganador (1-5):';
                    winningStarsInput.placeholder = 'Por ejemplo: 3';
                } else {
                    winningStarsLabel.innerHTML = '⭐ Introduce las estrellas ganadoras (1-12):';
                    winningStarsInput.placeholder = 'Por ejemplo: 2 11';
                }
            }
        } else {
            winningStarsInputSection.style.display = 'none';
        }
    }

    const validationResults = document.getElementById('validationResults');
    if(validationResults) validationResults.innerHTML = '';
    const winningNumbersInput = document.getElementById('winningNumbersInput') as HTMLInputElement;
    if(winningNumbersInput) winningNumbersInput.value = '';
    if(winningStarsInput) winningStarsInput.value = '';
    this.toggleModal('validationModal', true);
  }
  confirmValidation() {
    const inputEl = document.getElementById('winningNumbersInput') as HTMLInputElement;
    const starsInputEl = document.getElementById('winningStarsInput') as HTMLInputElement;
    if (!inputEl || !this.currentValidatingTicket) return;
    
    const gameId = this.currentValidatingTicket.gameId || 'datalotto49';
    const game = GAMES[gameId];
    const maxNumbers = game?.maxNumbers || 6;
    const maxStars = game?.maxStars || 0;
    const numberRange = game?.numberRange || 49;
    const starRange = game?.starRange || 0;

    const winningNumbers = Array.from(new Set(inputEl.value.split(/[ ,.]+/).map(n => parseInt(n)).filter(n => !isNaN(n) && n > 0 && n <= numberRange)));
    if (winningNumbers.length !== maxNumbers) {
      this.showToast(`Introduce ${maxNumbers} números ganadores válidos.`, 'error');
      return;
    }

    let winningStars: number[] = [];
    if (maxStars > 0 && starsInputEl) {
        const isGordo = gameId === 'gordo';
        winningStars = Array.from(new Set(starsInputEl.value.split(/[ ,.]+/).map(n => parseInt(n)).filter(n => {
            if (isNaN(n)) return false;
            if (isGordo) {
                return n >= 0 && n < starRange;
            } else {
                return n > 0 && n <= starRange;
            }
        })));
        if (winningStars.length !== maxStars) {
            const starLabelName = gameId === 'gordo' ? 'clave válida (0-9)' : (gameId === 'eurodreams' ? 'sueño válido (1-5)' : `${maxStars} estrellas ganadoras válidas`);
            this.showToast(`Introduce una ${starLabelName}.`, 'error');
            return;
        }
    }

    const ticketToUpdate = this.savedTickets.find(t => t.date === this.currentValidatingTicket!.date);
    if (ticketToUpdate) {
        const hits = ticketToUpdate.combinations.map(combo =>
            combo.filter(n => winningNumbers.includes(n)).length
        );
        
        let starHits: number[] | undefined = undefined;
        if (ticketToUpdate.stars) {
            starHits = ticketToUpdate.stars.map(stars =>
                stars.filter(n => winningStars.includes(n)).length
            );
        }

        ticketToUpdate.validation = {
            winningNumbers: winningNumbers,
            stars: winningStars.length > 0 ? winningStars : undefined,
            hits,
            starHits
        };
        this.saveState();
        this.updateSavedTickets();
        this.toggleModal('validationModal', false);
        this.showToast('Boleto validado manualmente.', 'success');
    } else {
        this.showToast('Error al encontrar el boleto para validar.', 'error');
    }
  }
  shareTicket() {
      if (!this.currentTicket) return;
      const text = `Mi boleto DataLotto49:\n${this.currentTicket.combinations.map(c => c.join(' - ')).join('\n')}`;
      if (navigator.share) {
          navigator.share({ title: 'Mi Boleto DataLotto49', text }).catch(console.error);
      } else {
          navigator.clipboard.writeText(text).then(() => this.showToast('Boleto copiado al portapapeles', 'success'));
      }
  }

  playTicketOnline(ticket: Ticket) {
    if (!ticket || ticket.combinations.length === 0) {
        this.showToast('No hay combinaciones para jugar.', 'warning');
        return;
    }

    // Store the ticket to play in a temporary property
    (this as any).pendingPlayTicket = ticket;
    this.renderPlayOnlineList();
    this.toggleModal('playOnlineModal', true);
  }

  confirmPlayOnline(gameKey: 'bonoloto' | 'primitiva' | 'euromillones' | 'eurodreams' | 'gordo') {
    const ticket = (this as any).pendingPlayTicket as Ticket;
    if (!ticket) return;

    let lotteryUrl = this.customGameUrls[gameKey] || '';
    if (!lotteryUrl || lotteryUrl.trim() === '') {
        // Enlace vacío! Avisamos al usuario y le permitimos escribirlo
        (this as any).pendingPlayGameKey = gameKey;
        const names: { [key: string]: string } = {
            bonoloto: '🇪🇸 Bonoloto España',
            primitiva: '🇪🇸 Primitiva España',
            gordo: '🏆 El Gordo',
            euromillones: '🇪🇺 Euromillones',
            eurodreams: '🌙 EuroDreams'
        };
        const label = document.getElementById('setUrlPromptLabel');
        if (label) {
            label.textContent = `${names[gameKey] || gameKey}:`;
        }
        const input = document.getElementById('setUrlPromptInput') as HTMLInputElement;
        if (input) {
            input.value = '';
            input.placeholder = 'https://...';
        }
        this.toggleModal('setUrlPromptModal', true);
        return;
    }

    let combosToPlay = ticket.combinations;

    if (ticket.combinations.length === 1 && ticket.combinations[0].length > 6) {
        combosToPlay = this.getCombinations(ticket.combinations[0], 6);
    }

    const formattedCombinations = combosToPlay
        .map(combo => 
            combo.sort((a, b) => a - b)
                 .map(n => String(n).padStart(2, '0'))
                 .join(' ')
        )
        .join('\n');

    navigator.clipboard.writeText(formattedCombinations)
        .then(() => {
            window.open(lotteryUrl, '_blank');
            this.toggleModal('playOnlineModal', false);
            this.showToast('🌐 Web abierta. ¡Combinaciones copiadas!', 'success');
        })
        .catch(err => {
            console.error('Error al copiar al portapapeles:', err);
            this.showToast('Error al copiar las combinaciones.', 'error');
        });
  }

  exportTickets() {
    if (this.savedTickets.length === 0) {
        this.showToast('No hay boletos para exportar.', 'warning');
        return;
    }
    try {
        const dataStr = JSON.stringify(this.savedTickets, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `datalotto49_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('✅ Boletos exportados correctamente.', 'success');
    } catch (error) {
        this.showToast('Error al exportar los boletos.', 'error');
        console.error('Export error:', error);
    }
  }


  // ===== HELPERS UI & GEOMETRIC/AI =====
  hasGeometricPattern(combination: number[], patternsToExclude: string[]): boolean {
      const coords = combination.map(n => this.getNumberCoords(n));
      const patternChecks: { [key: string]: () => boolean } = {
          lineas: () => this.isLine(coords),
          diagonales: () => this.isDiagonal(coords),
          triangulos: () => false, // No implementado para exclusión
          circulos: () => false,   // No implementado para exclusión
          cruces: () => false,     // No implementado para exclusión
      };
      for (const pattern of patternsToExclude) {
          if (patternChecks[pattern] && patternChecks[pattern]()) return true;
      }
      return false;
  }
  isSpaced(combination: number[]): boolean {
      const coords = combination.map(n => this.getNumberCoords(n));
      for (let i = 0; i < coords.length; i++) {
          for (let j = i + 1; j < coords.length; j++) {
              if (Math.abs(coords[i].col - coords[j].col) <= 1 && Math.abs(coords[i].row - coords[j].row) <= 1) {
                  return false; // Números adyacentes encontrados
              }
          }
      }
      return true;
  }
  isLine(coords: {row: number, col: number}[]): boolean {
      const allSameRow = coords.every(c => c.row === coords[0].row);
      const allSameCol = coords.every(c => c.col === coords[0].col);
      return allSameRow || allSameCol;
  }
  isDiagonal(coords: {row: number, col: number}[]): boolean {
      const mainDiagValue = coords[0].row - coords[0].col;
      if (coords.every(c => c.row - c.col === mainDiagValue)) return true;
      const antiDiagValue = coords[0].row + coords[0].col;
      if (coords.every(c => c.row + c.col === antiDiagValue)) return true;
      return false;
  }
  calculateCombinationScore(combination: number[], stars: number[] = []): number {
      let score = 0;
      combination.forEach(n => {
          if (this.hotNumbers.has(n)) score += 2;
          // Only penalize cold numbers if regression filter is OFF
          if (!this.filters.useRegression && this.coldNumbers.has(n)) score -= 1;
          
          // Favorite Bonus - Huge Priority
          if (this.favoriteNumbers.has(n)) score += 50;
      });

      if (stars.length > 0) {
          stars.forEach(n => {
              if (this.hotStars.has(n)) score += 5;
              if (this.favoriteStars.has(n)) score += 50;
          });
          const stats = this.getCombinationStats(combination, stars);
          if (stats.estrellas) {
              if (stats.estrellas.parImpar === '1/1') score += 15;
              if (stats.estrellas.suma >= 8 && stats.estrellas.suma <= 18) score += 10;
          }
      }

      if (this.filters.geometric.favor.includes('espaciados') && this.isSpaced(combination)) {
          score += 15;
      }
      if (this.filters.useMarkov) {
          score += this.getAIMarkovScore(combination);
      }
      if (this.filters.useNash) {
          score -= this.getAIPopularityPenalty(combination) * this.filters.ai.nashWeight;
      }
      if (this.filters.useRegression) {
          combination.forEach(n => {
              if (this.absentNumbers.has(n)) {
                score += this.filters.ai.regressionBonus * 1.5; // Mayor bonus para ausentes
              } else if (this.coldNumbers.has(n)) {
                score += this.filters.ai.regressionBonus; // Bonus normal para fríos
              }
          });
      }
      return score;
  }
  getAIMarkovScore(combination: number[]): number {
      if (this.historicalData.length < this.filters.ai.markovDepth) return 0;
      let score = 0;
      const lastDraws = this.historicalData.slice(-this.filters.ai.markovDepth).flatMap(d => d.numbers);
      const lastDrawsSet = new Set(lastDraws);
      combination.forEach(n => {
          if (lastDrawsSet.has(n)) score += lastDraws.filter(d => d === n).length;
      });
      return score;
  }
  getAIPopularityPenalty(combination: number[]): number {
      let penalty = 0;
      combination.forEach(n => {
          if (n <= 31) penalty += 2; // Penalize numbers in the "date range"
          const { row, col } = this.getNumberCoords(n);
          if (row === 0 || row === 6 || col === 0 || col === 6) penalty += 1; // Penalize edge numbers
      });
      if (this.isLine(combination.map(n => this.getNumberCoords(n)))) penalty += 10;
      return penalty;
  }
  showLoading(text: string) { 
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = text;
    const loadingInfo = document.getElementById('loadingInfo');
    if (loadingInfo) loadingInfo.textContent = 'Iniciando...';
    const loadingModal = document.getElementById('loadingModal') as HTMLElement;
    if (loadingModal) loadingModal.style.display = 'flex'; 
  }
  hideLoading() { 
    const loadingModal = document.getElementById('loadingModal') as HTMLElement;
    if (loadingModal) loadingModal.style.display = 'none';
  }
  showFilterSpinner() {
    const overlay = document.getElementById('filterSpinnerOverlay');
    if (overlay) overlay.classList.add('show');
  }
  hideFilterSpinner() {
    const overlay = document.getElementById('filterSpinnerOverlay');
    if (overlay) overlay.classList.remove('show');
  }

  showToast(message: string, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    const isError = type === 'warning' || type === 'error';
    
    toast.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <span style="flex: 1;">${message}</span>
        ${isError ? `
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button id="copyToastBtn" style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 0.8rem;">Copiar</button>
            <button id="closeToastBtn" style="background: rgba(0,0,0,0.2); border: 1px solid white; color: white; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 0.8rem;">Cerrar</button>
          </div>
        ` : ''}
      </div>
    `;
    
    toast.className = `toast show ${type}`;
    
    const dismiss = () => {
      toast.className = 'toast';
    };

    if (isError) {
      document.getElementById('closeToastBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss();
      });
      document.getElementById('copyToastBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(message).then(() => {
          const originalText = message;
          const span = toast.querySelector('span');
          if (span) span.textContent = '¡Copiado!';
          setTimeout(() => { if (span) span.textContent = originalText; }, 2000);
        });
      });
    } else {
      toast.onclick = dismiss;
    }
    
    const duration = isError ? 30000 : 4000; // 30 seconds for errors
    setTimeout(() => {
      if (toast.classList.contains('show')) {
        dismiss();
      }
    }, duration);
  }

  showUITrigger(message: string) {
    const container = document.getElementById('ticket');
    if (!container) return;

    this.clearUITrigger();

    const trigger = document.createElement('div');
    trigger.id = 'uiTrigger';
    trigger.className = 'ui-trigger';
    trigger.innerHTML = message;

    // Append to the end of the ticket container (below actions)
    container.appendChild(trigger);
  }

  clearUITrigger() {
    const existing = document.getElementById('uiTrigger');
    if (existing) existing.remove();
  }
  toggleModal(id: string, show: boolean) { 
    const modal = document.getElementById(id) as HTMLElement;
    if (modal) modal.style.display = show ? 'flex' : 'none';
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menuBtn');
    const overlay = document.getElementById('overlay');
    if (!sidebar || !menuBtn || !overlay) return;

    const isOpen = sidebar.classList.toggle('open');
    menuBtn.classList.toggle('open', isOpen);
    overlay.classList.toggle('show', isOpen);
  }

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menuBtn');
    const overlay = document.getElementById('overlay');
    if (!sidebar || !menuBtn || !overlay) return;

    sidebar.classList.remove('open');
    menuBtn.classList.remove('open');
    overlay.classList.remove('show');
  }

  openConfigUrlsModal() {
    const container = document.getElementById('configUrlsContainer');
    if (container) {
        container.innerHTML = '';
        
        // Define a map for nice names and flags
        const names: { [key: string]: string } = {
            bonoloto: '🇪🇸 Bonoloto',
            primitiva: '🇪🇸 Primitiva',
            gordo: '🏆 El Gordo',
            euromillones: '🇪🇺 Euromillones',
            eurodreams: '🌙 EuroDreams'
        };

        Object.keys(this.customGameUrls).forEach(key => {
            const gameName = names[key] || (key.charAt(0).toUpperCase() + key.slice(1));
            
            const group = document.createElement('div');
            group.className = 'input-group';
            group.style.display = 'flex';
            group.style.flexDirection = 'column';
            group.style.gap = '5px';
            
            const label = document.createElement('label');
            label.style.cssText = 'display: block; font-size: 0.85rem; color: var(--gray); font-weight: 600;';
            label.textContent = `URL ${gameName}:`;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `urlInput_${key}`;
            input.className = 'modal-input';
            input.style.width = '100%';
            input.value = this.customGameUrls[key] || '';
            input.placeholder = 'https://...';
            
            group.appendChild(label);
            group.appendChild(input);
            container.appendChild(group);
        });
    }
    
    this.closeSidebar();
    this.toggleModal('configUrlsModal', true);
  }

  saveConfigUrls() {
    Object.keys(this.customGameUrls).forEach(key => {
        const input = document.getElementById(`urlInput_${key}`) as HTMLInputElement;
        if (input) {
            this.customGameUrls[key] = input.value;
        }
    });
    
    this.saveState();
    this.toggleModal('configUrlsModal', false);
    this.showToast('✅ Enlaces guardados correctamente.', 'success');
  }

  openContactModal() {
    this.closeSidebar();
    const messageInput = document.getElementById('contactMessage') as HTMLTextAreaElement;
    const emailInput = document.getElementById('contactEmail') as HTMLInputElement;
    if (messageInput) messageInput.value = '';
    if (emailInput) emailInput.value = '';
    this.toggleModal('contactModal', true);
  }

  async sendContactForm() {
    const messageInput = document.getElementById('contactMessage') as HTMLTextAreaElement;
    const emailInput = document.getElementById('contactEmail') as HTMLInputElement;
    const message = messageInput?.value.trim();
    const email = emailInput?.value.trim();

    if (!message) {
      this.showToast('Por favor, escribe un mensaje.', 'warning');
      return;
    }

    const sendBtn = document.getElementById('sendContactBtn') as HTMLButtonElement;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando...';
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, email })
      });

      const data = await response.json();

      if (response.ok) {
        this.showToast('✅ Mensaje enviado correctamente. ¡Gracias!', 'success');
        this.toggleModal('contactModal', false);
      } else {
        throw new Error(data.error || 'Error al enviar');
      }
    } catch (error) {
      console.error('Error enviando contacto:', error);
      this.showToast('❌ Error al enviar el mensaje. Inténtalo de nuevo.', 'error');
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar';
      }
    }
  }

  toggleCollapse(targetId: string) {
    const content = document.getElementById(`${targetId}Content`);
    const btn = document.getElementById(`${targetId}CollapseBtn`);
    if (content && btn) {
        content.classList.toggle('expanded');
        btn.textContent = content.classList.contains('expanded') ? '-' : '+';
    }
  }

  // ===== NEW FEATURES =====

  renderFrequencyChart() {
    const container = document.getElementById('frequencyChartContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!this.dataLoaded || this.historicalData.length === 0) {
        container.innerHTML = '<div style="color:#666; text-align: center; width: 100%;">Carga datos para ver el gráfico.</div>';
        return;
    }

    const frequencies: { [key: number]: number } = {};
    for (let i = 1; i <= this.currentGame.numberRange; i++) frequencies[i] = 0;
    this.historicalData.forEach(draw => draw.numbers.forEach(num => {
        if (frequencies[num] !== undefined) frequencies[num]++;
    }));
    
    const starFrequencies: { [key: number]: number } = {};
    if (this.currentGame.maxStars > 0) {
        for (let i = 1; i <= this.currentGame.starRange; i++) starFrequencies[i] = 0;
        this.historicalData.forEach(draw => {
            if (draw.stars) {
                draw.stars.forEach(star => {
                    if (starFrequencies[star] !== undefined) starFrequencies[star]++;
                });
            }
        });
    }

    const allFreqs = [...Object.values(frequencies), ...Object.values(starFrequencies)];
    const maxFreq = Math.max(...allFreqs);
    if (maxFreq === 0) return;

    // Render Numbers
    for (let i = 1; i <= this.currentGame.numberRange; i++) {
        const freq = frequencies[i];
        const barHeight = (freq / maxFreq) * 100;
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-wrapper';
        barWrapper.title = `Número ${i}: ${freq} apariciones`;
        
        barWrapper.innerHTML = `
            <div class="bar-value">${freq}</div>
            <div class="chart-bar" style="height: ${barHeight}%"></div>
            <div class="bar-label">${i}</div>
        `;
        container.appendChild(barWrapper);
    }

    // Render Stars (if applicable)
    if (this.currentGame.maxStars > 0) {
        const separator = document.createElement('div');
        separator.style.width = '2px';
        separator.style.height = '100%';
        separator.style.background = '#e2e8f0';
        separator.style.margin = '0 10px';
        container.appendChild(separator);

        for (let i = 1; i <= this.currentGame.starRange; i++) {
            const freq = starFrequencies[i];
            const barHeight = (freq / maxFreq) * 100;
            
            const barWrapper = document.createElement('div');
            barWrapper.className = 'bar-wrapper star-bar';
            barWrapper.title = `Estrella ${i}: ${freq} apariciones`;
            
            barWrapper.innerHTML = `
                <div class="bar-value" style="color: #fbbf24;">${freq}</div>
                <div class="chart-bar" style="height: ${barHeight}%; background: linear-gradient(to top, #fbbf24, #f59e0b);"></div>
                <div class="bar-label" style="color: #d97706; font-weight: bold;">★${i}</div>
            `;
            container.appendChild(barWrapper);
        }
    }
  }

  // ===== BIG DATA INTELLIGENCE =====
  
  updateBigDataPanel() {
      const lastDrawsContainer = document.getElementById('lastDrawsDisplay');
      const dayTopContainer = document.getElementById('bdDayTopNumbers');
      const alertsContainer = document.getElementById('bdAlerts');
      
      if (!lastDrawsContainer || !dayTopContainer || !alertsContainer) return;
      
      if (this.historicalData.length < 2) {
          lastDrawsContainer.innerHTML = '<div style="color: #999; font-style: italic;">Datos insuficientes (mínimo 2 sorteos)</div>';
          dayTopContainer.innerHTML = '<span style="font-size: 0.8rem; color: #999;">-</span>';
          return;
      }

      // 1. Contexto Inmediato (N y N-1)
      const drawN = this.historicalData[this.historicalData.length - 1];
      const drawNminus1 = this.historicalData[this.historicalData.length - 2];
      
      const renderMiniDraw = (draw: Draw, label: string) => {
          const ballsHtml = draw.numbers.map(n => {
              let className = 'mini-ball';
              if (this.hotNumbers.has(n)) className += ' hot';
              else if (this.coldNumbers.has(n)) className += ' cold';
              return `<div class="${className}">${n}</div>`;
          }).join('');

          let starsHtml = '';
          if (draw.stars && draw.stars.length > 0) {
              starsHtml = draw.stars.map(s => `<div class="mini-ball star-ball">${s}</div>`).join('');
          }

          let extraHtml = '';
          if (this.currentGame.id !== 'euromillones') {
              if (draw.complementario !== undefined) {
                  extraHtml += `<div class="mini-ball" style="background: #3b82f6; color: white; border-color: #2563eb; font-size: 0.65rem; width: 24px; height: 24px;" title="Complementario">C${draw.complementario}</div>`;
              }
              if (draw.reintegro !== undefined) {
                  extraHtml += `<div class="mini-ball" style="background: #ef4444; color: white; border-color: #dc2626; font-size: 0.65rem; width: 24px; height: 24px;" title="Reintegro">R${draw.reintegro}</div>`;
              }
          }

          return `
            <div class="mini-draw-row">
                <div class="mini-draw-label">${label}</div>
                <div style="display: flex; gap: 4px;">${ballsHtml}</div>
                ${starsHtml ? `<div style="display: flex; gap: 4px; border-left: 1px solid #eee; padding-left: 8px; margin-left: 4px;">${starsHtml}</div>` : ''}
                ${extraHtml ? `<div style="display: flex; gap: 4px; border-left: 1px solid #eee; padding-left: 8px; margin-left: 4px;">${extraHtml}</div>` : ''}
                <span style="font-size: 0.7rem; color: #999; margin-left: auto;">${draw.date.toLocaleDateString()}</span>
            </div>
          `;
      };
      
      lastDrawsContainer.innerHTML = 
          renderMiniDraw(drawN, 'Último') + 
          renderMiniDraw(drawNminus1, 'Anterior');

      // 2. Patrones Temporales
      const daySelector = document.getElementById('nextDrawDay') as HTMLSelectElement;
      const selectedDay = parseInt(daySelector.value);
      
      const dayFrequencies: { [key: number]: number } = {};
      const dayStarFrequencies: { [key: number]: number } = {};
      let dayDrawCount = 0;
      
      this.historicalData.forEach(draw => {
          if (draw.date.getDay() === selectedDay) {
              dayDrawCount++;
              draw.numbers.forEach(n => {
                  dayFrequencies[n] = (dayFrequencies[n] || 0) + 1;
              });
              if (draw.stars) {
                  draw.stars.forEach(s => {
                      dayStarFrequencies[s] = (dayStarFrequencies[s] || 0) + 1;
                  });
              }
          }
      });

      if (dayDrawCount > 0) {
          const sortedDayFreq = Object.entries(dayFrequencies)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10) // Top 10
              .map(pair => parseInt(pair[0]));
              
          let html = sortedDayFreq.map(n => {
              let className = 'mini-ball';
              if (this.hotNumbers.has(n)) className += ' hot';
              else if (this.coldNumbers.has(n)) className += ' cold';
              return `<div class="${className}" title="Frecuencia: ${dayFrequencies[n]}">${n}</div>`;
          }).join('');

          if (this.currentGame.maxStars > 0) {
              const sortedDayStarFreq = Object.entries(dayStarFrequencies)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 2)
                  .map(pair => parseInt(pair[0]));
              
              if (sortedDayStarFreq.length > 0) {
                  html += `<div style="width: 1px; height: 15px; background: #ccc; margin: 0 5px;"></div>`;
                  html += sortedDayStarFreq.map(s => {
                      let className = 'mini-ball star-ball';
                      if (this.hotStars.has(s)) className += ' hot';
                      else if (this.coldStars.has(s)) className += ' cold';
                      return `<div class="${className}" title="Frecuencia: ${dayStarFrequencies[s]}">${s}</div>`;
                  }).join('');
              }
          }
          
          dayTopContainer.innerHTML = html;
      } else {
          dayTopContainer.innerHTML = '<span style="font-size: 0.8rem; color: #999;">Sin datos para este día.</span>';
      }

      // 3. Validación del Último Sorteo (NEW)
      let validationHtml = '';
      if (this.currentGame.id === 'euromillones') {
          const currentNumbers = Array.from(this.selectedNumbers);
          const currentStars = Array.from(this.selectedStars);
          
          if (currentNumbers.length > 0 || currentStars.length > 0) {
              const hits = currentNumbers.filter(n => drawN.numbers.includes(n)).length;
              const starHits = drawN.stars ? currentStars.filter(s => drawN.stars!.includes(s)).length : 0;
              
              validationHtml = `
                <div class="bd-alert ${hits + starHits > 0 ? 'success' : 'info'}" style="margin-bottom: 10px;">
                    🎯 <strong>Tu Selección vs Último:</strong> ${hits} nº + ${starHits} ⭐
                </div>
              `;
          }

          // Validate saved tickets against last draw
          const lastDrawDateStr = new Date(drawN.date.getTime() - (drawN.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
          const ticketsForLast = this.savedTickets.filter(t => t.gameId === 'euromillones' && t.drawDate === lastDrawDateStr);
          
          if (ticketsForLast.length > 0) {
              let totalHits = 0;
              let totalStarHits = 0;
              ticketsForLast.forEach(t => {
                  if (t.validation) {
                      totalHits += t.validation.hits.reduce((a, b) => a + b, 0);
                      if (t.validation.starHits) {
                          totalStarHits += t.validation.starHits.reduce((a, b) => a + b, 0);
                      }
                  }
              });
              
              validationHtml += `
                <div class="bd-alert success">
                    🎟️ <strong>Tus Boletos vs Último:</strong> ${totalHits} aciertos + ${totalStarHits} ⭐
                </div>
              `;
          }
      }

      // 4. Alertas
      alertsContainer.innerHTML = validationHtml;
      
      // Check double repetition
      const intersection = drawN.numbers.filter(n => drawNminus1.numbers.includes(n));
      if (intersection.length > 0) {
          alertsContainer.innerHTML += `
            <div class="bd-alert warning">
                ⚠️ Doble repetición detectada (${intersection.join(', ')}). Probabilidad rebote muy baja (0.8%).
            </div>
          `;
      }
      
      // Check absence warning (if hot number is absent for long)
      const superHot = Array.from(this.hotNumbers).find(n => (this.numberStats[n].lastSeen < this.historicalData.length - 10));
      if (superHot) {
           alertsContainer.innerHTML += `
            <div class="bd-alert info">
                💡 El "Caliente" ${superHot} lleva tiempo sin salir. ¿Oportunidad?
            </div>
          `;
      }
      
      // General advice based on N
      const repeatedInLast = drawN.numbers.filter(n => this.hotNumbers.has(n)).length;
      if (repeatedInLast > 3) {
           alertsContainer.innerHTML += `
            <div class="bd-alert success">
                🔥 El último sorteo fue muy "caliente". El próximo tiende a enfriar.
            </div>
          `;
      }
  }

  applyBigDataStrategy(type: string) {
      if (this.historicalData.length < 2) {
          this.showToast('Datos insuficientes para análisis Big Data.', 'warning');
          return;
      }

      const lastDraw = this.historicalData[this.historicalData.length - 1];
      const daySelector = document.getElementById('nextDrawDay') as HTMLSelectElement;
      const selectedDay = parseInt(daySelector.value);

      // Calculate day hot numbers again (could cache this)
      const dayFrequencies: { [key: number]: number } = {};
      this.historicalData.forEach(draw => {
          if (draw.date.getDay() === selectedDay) {
              draw.numbers.forEach(n => dayFrequencies[n] = (dayFrequencies[n] || 0) + 1);
          }
      });
      const topDayNumbers = Object.entries(dayFrequencies)
          .sort((a, b) => b[1] - a[1])
          .map(p => parseInt(p[0]));

      // Base Candidates: Day Hot + General Hot
      let candidates = new Set([...topDayNumbers.slice(0, 15), ...Array.from(this.hotNumbers)]);
      let suggestions: number[] = [];

      if (type === 'conservative') {
          // 0 Repetitions from last draw
          // Remove last draw numbers from candidates
          lastDraw.numbers.forEach(n => candidates.delete(n));
          
          // Pick top 6 from remaining
          suggestions = Array.from(candidates).slice(0, 6);
          this.showToast('Sugerencia Conservadora: 0 repeticiones.', 'info');

      } else if (type === 'balanced') {
          // 1 Repetition (Best one)
          // Find hottest number in last draw
          let bestRepeat = lastDraw.numbers[0];
          let maxFreq = -1;
          
          lastDraw.numbers.forEach(n => {
              const freq = this.numberStats[n].frequency;
              if (freq > maxFreq) {
                  maxFreq = freq;
                  bestRepeat = n;
              }
          });
          
          suggestions.push(bestRepeat);
          
          // Remove other last draw numbers
          lastDraw.numbers.forEach(n => {
              if (n !== bestRepeat) candidates.delete(n);
          });
           candidates.delete(bestRepeat); // Don't pick again

          // Fill rest
          suggestions.push(...Array.from(candidates).slice(0, 5));
           this.showToast('Sugerencia Balanceada: 1 repetición óptima.', 'info');

      } else if (type === 'risk') {
          // 2 Repetitions
           // Find top 2 hottest in last draw
          const sortedLast = [...lastDraw.numbers].sort((a, b) => this.numberStats[b].frequency - this.numberStats[a].frequency);
          suggestions.push(sortedLast[0], sortedLast[1]);
          
           // Remove others
           lastDraw.numbers.forEach(n => {
              if (n !== sortedLast[0] && n !== sortedLast[1]) candidates.delete(n);
          });
          candidates.delete(sortedLast[0]);
          candidates.delete(sortedLast[1]);

          // Fill rest
          suggestions.push(...Array.from(candidates).slice(0, 4));
           this.showToast('Sugerencia Riesgo: 2 repeticiones.', 'warning');
      }

      this.suggestedNumbers = new Set(suggestions);
      this.updateGridNumberStates();
      
      // Scroll to grid
      document.getElementById('numbersGrid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showFiltersDashboard() {
    this.closeSidebar();
    const mainApp = document.getElementById('mainAppContainer');
    const filtersDashboard = document.getElementById('filtersDashboardContainer');
    if (mainApp && filtersDashboard) {
        mainApp.style.display = 'none';
        filtersDashboard.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Update sidebar active state
        document.querySelectorAll('.sidebar-links li').forEach(li => li.classList.remove('active'));
        document.getElementById('filtersDashboardBtn')?.parentElement?.classList.add('active');
    }
  }

  showMainApp() {
    const mainApp = document.getElementById('mainAppContainer');
    const filtersDashboard = document.getElementById('filtersDashboardContainer');
    if (mainApp && filtersDashboard) {
        mainApp.style.display = 'block';
        filtersDashboard.style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Update sidebar active state
        document.querySelectorAll('.sidebar-links li').forEach(li => li.classList.remove('active'));
        document.querySelector('.sidebar-links a[data-action="home"]')?.parentElement?.classList.add('active');
    }
  }

  handleDashboardFilterClick(element: HTMLElement) {
    const filterGroup = element.dataset.filter!;
    const filterValue = element.dataset.value!;
    const filterKey = `${filterGroup}:${filterValue}`;
    
    if (this.activeDashboardFilters.has(filterKey)) {
        this.activeDashboardFilters.delete(filterKey);
        element.classList.remove('selected');
    } else {
        this.activeDashboardFilters.add(filterKey);
        element.classList.add('selected');
    }

    this.updateDashboardResults();
  }

  clearDashboardFilters() {
    this.activeDashboardFilters.clear();
    document.querySelectorAll('.db-filter-option').forEach(opt => opt.classList.remove('selected'));
    this.updateDashboardResults();
  }

  updateDashboardResults() {
    const activeFiltersContainer = document.getElementById('dbActiveFiltersContainer');
    if (activeFiltersContainer) {
        activeFiltersContainer.innerHTML = '';
        if (this.activeDashboardFilters.size === 0) {
            activeFiltersContainer.innerHTML = '<span style="color: #666; font-style: italic;">Ningún filtro seleccionado</span>';
        } else {
            this.activeDashboardFilters.forEach(filterKey => {
                const [group, value] = filterKey.split(':');
                const tag = document.createElement('span');
                tag.className = 'db-active-filter-tag';
                tag.textContent = `${group.toUpperCase()}: ${value}`;
                activeFiltersContainer.appendChild(tag);
            });
        }
    }

    // Calculate impact (simplified statistical model for the dashboard)
    let totalCombinations = 13983816;
    let successRate = 100;

    // Filter probabilities (approximate for 6/49)
    const filterProbabilities: Record<string, number> = {
        'suma:21-80': 0.006, 'suma:81-120': 0.13, 'suma:121-140': 0.20, 'suma:141-169': 0.32, 'suma:170-190': 0.20, 'suma:191-230': 0.13, 'suma:231-279': 0.014,
        'parImpar:6/0': 0.0096, 'parImpar:5/1': 0.2407, 'parImpar:4/2': 0.4349, 'parImpar:3/3': 0.2898, 'parImpar:2/4': 0.0217, 'parImpar:1/5': 0.0035, 'parImpar:0/6': 0.0127,
        'bajosAltos:6/0': 0.0127, 'bajosAltos:5/1': 0.0760, 'bajosAltos:4/2': 0.2304, 'bajosAltos:3/3': 0.3302, 'bajosAltos:2/4': 0.2304, 'bajosAltos:1/5': 0.0760, 'bajosAltos:0/6': 0.0096,
        'primos:0': 0.1975, 'primos:1': 0.3950, 'primos:2': 0.2963, 'primos:3': 0.0987, 'primos:4': 0.0118, 'primos:5': 0.0006, 'primos:6': 0.0004,
        'consecutivos:sin-consecutivos': 0.4362, 'consecutivos:1-par': 0.4110, 'consecutivos:2-pares': 0.1313, 'consecutivos:3-seguidos': 0.0185, 'consecutivos:4-seguidos': 0.0030,
        'decenas:2/2/1/1': 0.3866, 'decenas:2/1/1/1/1': 0.3093, 'decenas:3/2/1': 0.1547, 'decenas:2/2/2': 0.0773, 'decenas:otros': 0.0721
    };

    // Group active filters by category
    const groupedFilters: Record<string, string[]> = {};
    this.activeDashboardFilters.forEach(filterKey => {
        const [group, value] = filterKey.split(':');
        if (!groupedFilters[group]) groupedFilters[group] = [];
        groupedFilters[group].push(value);
    });

    // Apply probabilities group by group
    // If multiple options in a group are selected, sum their probabilities
    Object.keys(groupedFilters).forEach(group => {
        const selectedValues = groupedFilters[group];
        let groupProb = 0;
        selectedValues.forEach(val => {
            groupProb += filterProbabilities[`${group}:${val}`] || 0;
        });
        
        // If no options were selected in this group (shouldn't happen due to logic above), prob is 1
        // If some were selected, multiply the overall success rate
        if (groupProb > 0) {
            successRate = successRate * groupProb;
        }
    });

    const currentCombinations = Math.floor(totalCombinations * (successRate / 100));

    // Update UI
    const successRateEl = document.getElementById('dbSuccessRate');
    const combinationsCountEl = document.getElementById('dbCombinationsCount');
    const progressBarEl = document.getElementById('dbProgressBar');
    const probValueEl = document.getElementById('dbProbValue');
    const filterCountEl = document.getElementById('dbFilterCount');
    const reductionValueEl = document.getElementById('dbReductionValue');

    if (successRateEl) successRateEl.textContent = `${successRate.toFixed(2)}%`;
    if (combinationsCountEl) combinationsCountEl.textContent = `${currentCombinations.toLocaleString()} combinaciones`;
    if (progressBarEl) {
        progressBarEl.style.width = `${successRate}%`;
        progressBarEl.textContent = `${successRate.toFixed(1)}%`;
    }
    if (probValueEl) {
        if (successRate > 0) {
            probValueEl.textContent = `1 entre ${Math.floor(100 / successRate)}`;
        } else {
            probValueEl.textContent = "Casi imposible";
        }
    }
    if (filterCountEl) filterCountEl.textContent = String(this.activeDashboardFilters.size);
    
    const reduction = ((totalCombinations - currentCombinations) / totalCombinations * 100).toFixed(2);
    if (reductionValueEl) reductionValueEl.textContent = `${reduction}%`;

    // Strategy Advice
    const strategyAdviceEl = document.getElementById('dbStrategyAdvice');
    if (strategyAdviceEl) {
        if (successRate > 40) {
            strategyAdviceEl.textContent = "Estrategia de alta cobertura. Ideal para apuestas múltiples con alta probabilidad de premios menores.";
        } else if (successRate > 15) {
            strategyAdviceEl.textContent = "Estrategia equilibrada. Filtros optimizados para capturar el núcleo estadístico del sorteo.";
        } else {
            strategyAdviceEl.textContent = "Estrategia de alta precisión. Gran reducción de combinaciones, enfocada en patrones de alta rentabilidad.";
        }
    }
  }

  switchDashboardTab(tabId: string) {
    document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.db-tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.db-tab[data-tab="${tabId}"]`)?.classList.add('active');
    document.getElementById(tabId)?.classList.add('active');
  }

  // ============================================
  // AI & CORRELATION ENGINE
  // ============================================

  async handleAiPrediction() {
    if (!this.dataLoaded || this.historicalData.length === 0) {
      this.showToast('Carga datos históricos primero para usar la IA.', 'warning');
      return;
    }

    const aiModal = document.getElementById('aiPredictionModal');
    const aiContent = document.getElementById('aiPredictionContent');
    const applyBtn = document.getElementById('applyAiNumbersBtn') as HTMLButtonElement;

    if (!aiModal || !aiContent || !applyBtn) return;

    this.toggleModal('aiPredictionModal', true);
    aiContent.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 space-y-4">
        <div class="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-gray-600 font-medium animate-pulse">Analizando patrones históricos con Gemini AI...</p>
        <p class="text-xs text-gray-400">Esto puede tardar unos segundos</p>
      </div>
    `;
    applyBtn.disabled = true;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('API Key de Gemini no configurada.');
      }

      const genAI = new GoogleGenAI({ apiKey });

      // Preparar datos para el prompt (últimos 50 sorteos)
      const recentDraws = this.historicalData.slice(0, 50).map(d => {
          let line = d.numbers.join(',');
          if (d.stars && d.stars.length > 0) line += ` + Stars: ${d.stars.join(',')}`;
          return line;
      }).join('\n');
      
      const prompt = `
        Eres un experto en análisis estadístico y teoría de juegos aplicado a loterías (${this.currentGame.name}).
        Analiza los siguientes últimos 50 resultados históricos:
        ${recentDraws}

        Basándote en:
        1. Frecuencia de aparición (números calientes/fríos).
        2. Intervalos de ausencia (números que "tocan").
        3. Patrones de paridad y sumas.
        4. Distribución en la cuadrícula.

        Genera una predicción de ${this.currentGame.maxNumbers} números (1-${this.currentGame.numberRange})${this.currentGame.maxStars > 0 ? ' y ' + this.currentGame.maxStars + ' estrellas (1-' + this.currentGame.starRange + ')' : ''} con una explicación detallada del porqué de esa combinación.
        Responde en formato JSON con esta estructura:
        {
          "numbers": [n1, n2, n3, n4, n5, n6],
          ${this.currentGame.maxStars > 0 ? '"stars": [s1, s2],' : ''}
          "explanation": "Tu análisis aquí...",
          "confidence": 85
        }
      `;

      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const responseText = result.text;
      if (!responseText) throw new Error('Respuesta de IA vacía');
      const response = JSON.parse(responseText);
      
      aiContent.innerHTML = `
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-indigo-900">Combinación Sugerida</h3>
            <div class="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold">
              Confianza: ${response.confidence}%
            </div>
          </div>
          
          <div class="flex flex-wrap items-center gap-3 p-6 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-inner">
            ${response.numbers.sort((a:number,b:number)=>a-b).map((n:number) => `
              <div class="w-12 h-12 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center text-lg font-bold text-indigo-700 shadow-sm">
                ${n}
              </div>
            `).join('')}
            ${response.stars ? `
                <div class="mx-2 text-indigo-400 font-bold">+</div>
                ${response.stars.sort((a:number,b:number)=>a-b).map((n:number) => `
                  <div class="w-12 h-12 rounded-full bg-amber-400 border-2 border-amber-500 flex items-center justify-center text-lg font-bold text-amber-900 shadow-sm">
                    ${n}
                  </div>
                `).join('')}
            ` : ''}
          </div>

          <div class="bg-white p-4 rounded-xl border border-gray-100 space-y-2">
            <h4 class="text-sm font-bold text-gray-400 uppercase tracking-wider">Análisis de la IA</h4>
            <p class="text-gray-700 leading-relaxed text-sm italic">
              "${response.explanation}"
            </p>
          </div>
          
          <div class="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start space-x-3">
            <div class="text-amber-500 mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
            <p class="text-xs text-amber-800 leading-tight">
              Recuerda que esta predicción es puramente estadística y no garantiza premios. Juega con responsabilidad.
            </p>
          </div>
        </div>
      `;

      // Guardar números sugeridos para aplicar
      (aiModal as any)._suggestedNumbers = response.numbers;
      (aiModal as any)._suggestedStars = response.stars;
      applyBtn.disabled = false;

    } catch (error) {
      console.error('AI Error:', error);
      aiContent.innerHTML = `
        <div class="p-6 text-center space-y-4">
          <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl">⚠️</div>
          <h3 class="text-lg font-bold text-red-900">Error en la Predicción</h3>
          <p class="text-gray-600">No pudimos conectar con el motor de IA. Por favor, inténtalo de nuevo más tarde.</p>
          <button onclick="location.reload()" class="text-indigo-600 font-bold hover:underline">Recargar aplicación</button>
        </div>
      `;
    }
  }

  applyAiNumbers() {
    const aiModal = document.getElementById('aiPredictionModal');
    const numbers = (aiModal as any)?._suggestedNumbers;
    const stars = (aiModal as any)?._suggestedStars;
    
    if (numbers && Array.isArray(numbers)) {
      this.clearSelections(false);
      numbers.forEach(n => this.addNumber(n, 'number'));
      if (stars && Array.isArray(stars)) {
          stars.forEach(s => this.addNumber(s, 'star'));
      }
      this.toggleModal('aiPredictionModal', false);
      this.showToast('Combinación de IA aplicada correctamente.', 'success');
    }
  }

  updateCorrelationScore() {
    if (!this.correlationScoreContainer || (this.selectedNumbers.size === 0 && this.selectedStars.size === 0)) {
      if (this.correlationScoreContainer) this.correlationScoreContainer.style.display = 'none';
      return;
    }

    this.correlationScoreContainer.style.display = 'block';
    
    const selected = Array.from(this.selectedNumbers);
    const selectedStars = Array.from(this.selectedStars);
    let score = 50; // Base score
    let advice = "";

    const maxNumbers = this.currentGame.maxNumbers;
    const maxStars = this.currentGame.maxStars;

    // 1. Balance Par/Impar
    const evens = selected.filter(n => n % 2 === 0).length;
    const idealEvens = Math.floor(maxNumbers / 2);
    if (evens === idealEvens || evens === idealEvens + 1) score += 15;
    else if (Math.abs(evens - idealEvens) <= 1) score += 10;
    else score -= 10;

    // 2. Balance Bajo/Alto
    const midPoint = Math.floor(this.currentGame.numberRange / 2);
    const lows = selected.filter(n => n <= midPoint).length;
    const idealLows = Math.floor(maxNumbers / 2);
    if (lows === idealLows || lows === idealLows + 1) score += 15;
    else if (Math.abs(lows - idealLows) <= 1) score += 10;
    else score -= 10;

    // 3. Correlación con Calientes/Fríos/Ausentes
    if (this.dataLoaded) {
      const hotCount = selected.filter(n => this.hotNumbers.has(n)).length;
      const coldCount = selected.filter(n => this.coldNumbers.has(n)).length;
      const neutralCount = selected.filter(n => !this.hotNumbers.has(n) && !this.coldNumbers.has(n)).length;

      const target = this.currentSuggestedProfile;
      
      if (hotCount === target.hot) score += 10;
      else if (Math.abs(hotCount - target.hot) === 1) score += 5;
      
      if (coldCount === target.cold) score += 10;
      else if (Math.abs(coldCount - target.cold) === 1) score += 5;

      if (neutralCount === target.neutral) score += 5;

      // Correlación de Estrellas
      if (maxStars > 0 && selectedStars.length === maxStars) {
          const hotStarCount = selectedStars.filter(s => this.hotStars.has(s)).length;
          const coldStarCount = selectedStars.filter(s => this.coldStars.has(s)).length;
          
          if (target.starHot !== undefined && hotStarCount === target.starHot) score += 5;
          if (target.starCold !== undefined && coldStarCount === target.starCold) score += 5;
      }
    }

    // 4. Suma Total (Dinámico según el juego)
    const totalSum = selected.reduce((a, b) => a + b, 0);
    const avgNum = (1 + this.currentGame.numberRange) / 2;
    const idealSum = avgNum * maxNumbers;
    const sumRange = idealSum * 0.2; // +/- 20%
    
    if (totalSum >= (idealSum - sumRange) && totalSum <= (idealSum + sumRange)) score += 10;
    else if (totalSum < (idealSum - sumRange * 2) || totalSum > (idealSum + sumRange * 2)) score -= 15;

    // 5. Estrellas (si aplica)
    if (maxStars > 0 && selectedStars.length === maxStars) {
        const starEvens = selectedStars.filter(n => n % 2 === 0).length;
        const starMid = Math.floor(this.currentGame.starRange / 2);
        const starLows = selectedStars.filter(n => n <= starMid).length;

        // Balance Par/Impar Estrellas
        if (maxStars === 2) {
            if (starEvens === 1) score += 10; // 1P/1I es ideal
            else score += 5;
        }

        // Balance Bajo/Alto Estrellas
        if (maxStars === 2) {
            if (starLows === 1) score += 5; // 1B/1A es ideal
        }
        
        // Suma Estrellas
        const starSum = selectedStars.reduce((a, b) => a + b, 0);
        const avgStar = (1 + this.currentGame.starRange) / 2;
        const idealStarSum = avgStar * maxStars;
        if (Math.abs(starSum - idealStarSum) <= this.currentGame.starRange * 0.5) score += 5;
    }

    // Normalizar score 0-100
    score = Math.max(0, Math.min(100, score));

    // Generar consejo
    if (score >= 80) advice = "Excelente combinación. Sigue patrones estadísticos muy probables.";
    else if (score >= 60) advice = "Buena combinación. Tiene un balance sólido de factores.";
    else if (score >= 40) advice = "Combinación aceptable, pero podrías mejorar el balance par/impar o la suma.";
    else advice = "Combinación poco probable estadísticamente. Considera revisar el balance de números.";

    // Actualizar UI
    if (this.correlationScoreValue) this.correlationScoreValue.textContent = `${score}%`;
    if (this.correlationScoreBar) {
      this.correlationScoreBar.style.width = `${score}%`;
      this.correlationScoreBar.className = 'h-full transition-all duration-500 rounded-full ' + 
        (score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-indigo-500' : 'bg-amber-500');
    }
    if (this.correlationAdvice) this.correlationAdvice.textContent = advice;
  }

  updateBacktestUI() {
      const controls = document.querySelector('.backtesting-controls') as HTMLElement;
      const actions = document.querySelector('.backtesting-actions') as HTMLElement;
      const results = document.getElementById('backtestResults') as HTMLElement;
      const alertNoData = document.getElementById('backtestNoDataAlert') as HTMLElement;

      if (!this.dataLoaded || this.historicalData.length === 0) {
          if (controls) controls.style.display = 'none';
          if (actions) actions.style.display = 'none';
          if (results) results.style.display = 'none';
          if (alertNoData) alertNoData.style.display = 'block';
      } else {
          if (controls) controls.style.display = 'grid';
          if (actions) actions.style.display = 'block';
          if (alertNoData) alertNoData.style.display = 'none';
      }
  }

  calculateDrawPrize(hits: number, starHits: number, draw: Draw, combo: number[]): number {
      const gId = this.currentGame.id;

      if (gId === 'euromillones') {
          if (hits === 5 && starHits === 2) return 40000000;
          if (hits === 5 && starHits === 1) return 150000;
          if (hits === 5 && starHits === 0) return 20000;
          if (hits === 4 && starHits === 2) return 1200;
          if (hits === 4 && starHits === 1) return 120;
          if (hits === 3 && starHits === 2) return 50;
          if (hits === 4 && starHits === 0) return 40;
          if (hits === 2 && starHits === 2) return 14;
          if (hits === 3 && starHits === 1) return 11;
          if (hits === 3 && starHits === 0) return 9;
          if (hits === 1 && starHits === 2) return 7;
          if (hits === 2 && starHits === 1) return 6;
          if (hits === 2 && starHits === 0) return 4;
          return 0;
      }

      if (gId === 'eurodreams') {
          if (hits === 6 && starHits === 1) return 7200000; // Capital estimado total de 20k/mes por 30 años
          if (hits === 6 && starHits === 0) return 120000;  // 2k/mes por 5 años
          if (hits === 5 && starHits === 0) return 120;
          if (hits === 4 && starHits === 0) return 40;
          if (hits === 3 && starHits === 0) return 5;
          if (hits === 2 && starHits === 0) return 2.50; // Reintegro
          return 0;
      }

      if (gId === 'gordo') {
          if (hits === 5 && starHits === 1) return 5000000;
          if (hits === 5 && starHits === 0) return 18000;
          if (hits === 4 && starHits === 1) return 900;
          if (hits === 4 && starHits === 0) return 120;
          if (hits === 3 && starHits === 1) return 45;
          if (hits === 3 && starHits === 0) return 12;
          if (hits === 2 && starHits === 1) return 8;
          if (hits === 2 && starHits === 0) return 3;
          if (hits === 1 && starHits === 1) return 3;
          if (hits === 0 && starHits === 1) return 1.50; // Devolución/Reintegro por Número Clave
          return 0;
      }

      // Por defecto 6/49 (Bonoloto o Primitiva)
      const isBonoloto = this.dataType === 'bonoloto';
      const jackpot = isBonoloto ? 800000 : 1500000;
      const rVal = isBonoloto ? 0.50 : 1.00;

      if (hits === 6) return jackpot;
      
      // Comprobar complementario para 5 aciertos
      if (hits === 5) {
          if (draw.complementario && combo.includes(draw.complementario)) {
               return isBonoloto ? 25000 : 45000;
          }
          return 1000;
      }

      if (hits === 4) return isBonoloto ? 25 : 45;
      if (hits === 3) return isBonoloto ? 4 : 8;

      // Simular reintegro con un 10% de probabilidad asignada
      if (draw.reintegro !== undefined) {
          if (Math.random() < 0.10) {
              return rVal;
          }
      }

      return 0;
  }

  async runBacktest() {
      // Comprobar si hay datos cargados
      if (!this.dataLoaded || this.historicalData.length === 0) {
          this.showToast('No hay datos históricos cargados para realizar el backtesting.', 'error');
          return;
      }

      this.updateFilterStateFromUI();

      const periodVal = (document.getElementById('backtestPeriod') as HTMLSelectElement).value;
      const modeVal = (document.getElementById('backtestMode') as HTMLSelectElement).value;

      let drawsToTest = [...this.historicalData];
      if (periodVal !== 'all') {
          const limit = parseInt(periodVal);
          drawsToTest = drawsToTest.slice(-limit);
      }

      const totalDraws = drawsToTest.length;
      if (totalDraws === 0) {
          this.showToast('No hay sorteos seleccionados para evaluar.', 'error');
          return;
      }

      const btn = document.getElementById('runBacktestBtn');
      const progressContainer = document.getElementById('backtestProgressContainer');
      const progressBar = document.getElementById('backtestProgressBar');
      const progressText = document.getElementById('backtestProgressText');
      const resultsDiv = document.getElementById('backtestResults');

      if (btn) (btn as HTMLButtonElement).disabled = true;
      if (progressContainer) progressContainer.style.display = 'block';
      if (resultsDiv) resultsDiv.style.display = 'none';

      // Reset y actualización dinámica de etiquetas según la modalidad
      const lblTotalDraws = document.getElementById('lblTotalDraws');
      const lblTicketPrice = document.getElementById('lblTicketPrice');
      const lblTotalSpent = document.getElementById('lblTotalSpent');
      const lblTotalWon = document.getElementById('lblTotalWon');
      const lblBalance = document.getElementById('lblBalance');
      const lblROI = document.getElementById('lblROI');
      const btBreakdownTitle = document.getElementById('btBreakdownTitle');

      if (modeVal === 'filters') {
          if (lblTotalDraws) lblTotalDraws.textContent = "Sorteos Históricos";
          if (lblTicketPrice) lblTicketPrice.textContent = "Ganadores Admitidos";
          if (lblTotalSpent) lblTotalSpent.textContent = "Ganadores Excluidos";
          if (lblTotalWon) lblTotalWon.textContent = "Tasa de Aceptación Histórica";
          if (lblBalance) lblBalance.textContent = "Reducción de Universo";
          if (lblROI) lblROI.textContent = "Eficiencia de Filtros (Factor)";
          if (btBreakdownTitle) btBreakdownTitle.textContent = "📋 Registro Histórico de Validez de los Filtros";
      } else {
          if (lblTotalDraws) lblTotalDraws.textContent = "Sorteos Simulados";
          if (lblTicketPrice) lblTicketPrice.textContent = "Precio por Apuesta";
          if (lblTotalSpent) lblTotalSpent.textContent = "Presupuesto Invertido";
          if (lblTotalWon) lblTotalWon.textContent = "Premios Recuperados";
          if (lblBalance) lblBalance.textContent = "Balance Neto";
          if (lblROI) lblROI.textContent = "Retorno de Inversión (ROI)";
          if (btBreakdownTitle) btBreakdownTitle.textContent = "🏆 Desglose Detallado de Aciertos";
      }

      const maxNumbers = this.currentGame.maxNumbers;
      const maxStars = this.currentGame.maxStars;
      const availableUniverse = this.getAvailableUniverse('number');
      const availableStars = this.getAvailableUniverse('star');

      // --- Rama 1: Análisis exclusivo de Eficacia de Filtros ---
      if (modeVal === 'filters') {
          let passedDrawsCount = 0;
          const drawDetails: { draw: Draw; passed: boolean }[] = [];

          // Procesar validez de sorteos reales con un ligero delay para dinamismo visual
          for (let index = 0; index < totalDraws; index++) {
              const draw = drawsToTest[index];

              const pct = Math.floor(((index + 0.3) / totalDraws) * 100);
              if (progressBar) progressBar.style.width = `${pct / 2}%`; // Primera mitad de la barra
              if (progressText) progressText.textContent = `${Math.floor(pct / 2)}%`;

              if (index % 12 === 0) {
                  await new Promise(resolve => setTimeout(resolve, 0));
              }

              // Validar el sorteo ganador real frente a los filtros activos en la UI
              const isPassed = this.isValidCombination(draw.numbers, draw.stars || []);
              if (isPassed) {
                  passedDrawsCount++;
              }
              drawDetails.push({ draw, passed: isPassed });
          }

          // Métricas Monte Carlo para estimar la tasa de Reducción de Universo
          let sampleCount = 1500;
          let passedSample = 0;
          for (let i = 0; i < sampleCount; i++) {
              if (i % 300 === 0) {
                  const pctSample = 50 + Math.floor((i / sampleCount) * 50);
                  if (progressBar) progressBar.style.width = `${pctSample}%`;
                  if (progressText) progressText.textContent = `${pctSample}%`;
                  await new Promise(resolve => setTimeout(resolve, 0));
              }
              const combo = this.generateRandomCombination(availableUniverse, maxNumbers);
              const stars = maxStars > 0 ? this.generateRandomCombination(availableStars, maxStars) : [];
              if (this.isValidCombination(combo, stars)) {
                  passedSample++;
              }
          }

          const passRate = (passedSample / sampleCount) * 100;
          const reductionRate = 100 - passRate;

          // Factor de eficiencia de rentas: Tasa de acierto sorteo loto / tasa paso aleatorio
          const p_win = passedDrawsCount / totalDraws;
          const p_univ = Math.max(passedSample, 1) / sampleCount;
          const efficiency = p_win / p_univ;

          // Renderizar métricas en la interfaz
          const elTotalDraws = document.getElementById('btTotalDraws');
          const elTicketPrice = document.getElementById('btTicketPrice');
          const elSpent = document.getElementById('btTotalSpent');
          const elWon = document.getElementById('btTotalWon');
          const elBalance = document.getElementById('btBalance');
          const elROI = document.getElementById('btROI');
          const elExpVal = document.getElementById('btExpectedValue');
          const elExpValAdvice = document.getElementById('btExpectedValueAdvice');
          const elHitsBreakdown = document.getElementById('btHitsBreakdownContainer');

          if (elTotalDraws) elTotalDraws.textContent = String(totalDraws);
          if (elTicketPrice) elTicketPrice.textContent = `${passedDrawsCount} sorteos`;
          if (elSpent) elSpent.textContent = `${totalDraws - passedDrawsCount} sorteos`;
          
          const passRateWinning = (passedDrawsCount / totalDraws) * 100;
          if (elWon) elWon.textContent = `${passRateWinning.toFixed(1)} %`;
          
          if (elBalance) {
              elBalance.textContent = `${reductionRate.toFixed(2)} %`;
              elBalance.style.color = reductionRate >= 90 ? 'var(--success)' : reductionRate >= 60 ? '#d97706' : 'var(--danger)';
          }

          if (elROI) {
              elROI.textContent = `${efficiency.toFixed(2)}x`;
              elROI.style.color = efficiency >= 1.25 ? 'var(--success)' : efficiency >= 0.8 ? '#d97706' : 'var(--danger)';
          }

          if (elExpVal) {
              elExpVal.textContent = `Poder del Filtro: ${efficiency >= 1.4 ? 'Excelente' : efficiency >= 1.1 ? 'Bueno' : efficiency >= 0.8 ? 'Neutro' : 'Bajo / Poco representativo'}`;
              elExpVal.style.color = efficiency >= 1.1 ? 'var(--success)' : efficiency >= 0.8 ? '#d97706' : 'var(--danger)';
          }

          if (elExpValAdvice) {
              let adviceText = '';
              if (efficiency > 1.25) {
                  adviceText = `📊 ¡Filtros de Alto Rendimiento! Tu factor de eficiencia (${efficiency.toFixed(2)}x) demuestra matemáticamente que la configuración reduce eficazmente el ruido aleatorio (${reductionRate.toFixed(1)}% descartado) sin perjudicar la tasa de aciertos (${passRateWinning.toFixed(1)}% capturados). ¡Excelente diseño!`;
              } else if (efficiency >= 0.8) {
                  adviceText = `⚖️ Nivel de Equilibrio Estándar (${efficiency.toFixed(2)}x). Los filtros descartan el ${reductionRate.toFixed(1)}% del universo de combinaciones posibles reteniendo el ${passRateWinning.toFixed(1)}% de sorteos históricos correctos. Puedes afinar mejor los rangos para aumentar la eficiencia sobre 1.20x.`;
              } else {
                  adviceText = `⚠️ Ajusta tu configuración. Tus filtros descartan demasiados ganadores reales en relación a la reducción que ofrecen (Eficiencia de apenas ${efficiency.toFixed(2)}x). Modula los rangos límites para evitar sesgar el resultado.`;
              }
              elExpValAdvice.textContent = adviceText;
          }

          if (elHitsBreakdown) {
              elHitsBreakdown.innerHTML = '';
              let breakdownHTML = `<table class="validation-summary-table">
                  <tr>
                      <th>Fecha del Sorteo</th>
                      <th>Combinación Ganadora Histórica</th>
                      <th>Estado del Filtro</th>
                  </tr>`;

              // Mostrar solo los últimos 50 sorteos para mantener óptimo el renderizado del DOM
              const drawingsToShow = drawDetails.slice(-50).reverse();
              drawingsToShow.forEach(({ draw, passed }) => {
                  const numbersStr = draw.numbers.join(', ');
                  let starsInfo = '';
                  if (draw.stars && draw.stars.length > 0) {
                      const starIcon = this.currentGame.id === 'eurodreams' ? '🌙' : (this.currentGame.id === 'gordo' ? '🔑' : '⭐');
                      starsInfo = ` | <span style="background: rgba(251,191,36,0.15); color: #d97706; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">${starIcon} ${draw.stars.join('-')}</span>`;
                  }

                  const badgeHTML = passed 
                      ? `<span style="background: rgba(16,185,129,0.15); color: var(--success); padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 0.82rem; display: inline-block;">✅ EN FILTRO (Admitido)</span>`
                      : `<span style="background: rgba(239,68,68,0.1); color: var(--danger); padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 0.82rem; display: inline-block;">❌ EXCLUIDO</span>`;

                  breakdownHTML += `
                      <tr>
                          <td><strong>${draw.date}</strong></td>
                          <td>${numbersStr}${starsInfo}</td>
                          <td>${badgeHTML}</td>
                      </tr>`;
              });
              breakdownHTML += `</table>`;

              if (drawDetails.length > 50) {
                  breakdownHTML += `<div style="text-align: center; color: var(--gray); font-size: 0.8rem; font-style: italic; margin-top: 10px;">
                      * Mostrando últimos 50 sorteos históricos para un renderizado ágil de tablas.
                  </div>`;
              }
              elHitsBreakdown.innerHTML = breakdownHTML;
          }

          if (btn) (btn as HTMLButtonElement).disabled = false;
          if (progressContainer) progressContainer.style.display = 'none';
          if (resultsDiv) resultsDiv.style.display = 'block';

          this.showToast('✅ ¡Eficacia de filtros evaluada con éxito!', 'success');
          return;
      }

      // --- Rama 2: Simulación de Apuestas / Boletos (Current / Generative) ---
      
      // Determinar precio de boleto mercantil real
      let ticketPrice = 1.0;
      if (this.currentGame.id === 'euromillones') {
          ticketPrice = 2.50;
      } else if (this.currentGame.id === 'eurodreams') {
          ticketPrice = 2.50;
      } else if (this.currentGame.id === 'gordo') {
          ticketPrice = 1.50;
      } else {
          if (this.dataType === 'bonoloto') {
              ticketPrice = 0.50;
          } else {
              ticketPrice = 1.00;
          }
      }

      // Combinaciones a probar
      let combosToTest: number[][] = [];
      let starsToTest: number[][] = [];

      if (modeVal === 'current') {
          if (this.currentTicket) {
              combosToTest = this.currentTicket.combinations;
              starsToTest = this.currentTicket.stars || [];
          } else if (this.selectedNumbers.size === maxNumbers && this.selectedStars.size === maxStars) {
              combosToTest = [Array.from(this.selectedNumbers).sort((a,b)=>a-b)];
              starsToTest = [Array.from(this.selectedStars).sort((a,b)=>a-b)];
          } else {
              this.showToast(`Por favor, selecciona exactamente ${maxNumbers} números y ${maxStars} estrellas, o genera un boleto inteligente antes de testear.`, 'warning');
              if (btn) (btn as HTMLButtonElement).disabled = false;
              if (progressContainer) progressContainer.style.display = 'none';
              return;
          }
      }

      // Restablecer estadísticas financieras
      let totalSpent = 0;
      let totalWon = 0;
      const breakdownCounts: { [label: string]: number } = {};

      // Bucle de simulación amortizado
      for (let index = 0; index < totalDraws; index++) {
          const draw = drawsToTest[index];

          const pct = Math.floor(((index + 1) / totalDraws) * 100);
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressText) progressText.textContent = `${pct}%`;

          let currentCombo: number[][] = [];
          let currentStars: number[][] = [];

          if (modeVal === 'generative') {
              if (index % 5 === 0) {
                  await new Promise(resolve => setTimeout(resolve, 0));
              }

              let found = false;
              for (let i = 0; i < 1000; i++) {
                  const combo = this.generateRandomCombination(availableUniverse, maxNumbers);
                  const stars = maxStars > 0 ? this.generateRandomCombination(availableStars, maxStars) : [];
                  if (this.isValidCombination(combo, stars)) {
                      currentCombo = [combo];
                      currentStars = [stars];
                      found = true;
                      break;
                  }
              }
              if (!found) {
                  currentCombo = [this.generateRandomCombination(availableUniverse, maxNumbers)];
                  currentStars = [maxStars > 0 ? this.generateRandomCombination(availableStars, maxStars) : []];
              }
          } else {
              currentCombo = combosToTest;
              currentStars = starsToTest;
          }

          const numPlays = currentCombo.length;
          totalSpent += numPlays * ticketPrice;

          for (let pIdx = 0; pIdx < numPlays; pIdx++) {
              const combo = currentCombo[pIdx];
              const stars = currentStars[pIdx] || [];

              const hits = combo.filter(n => draw.numbers.includes(n)).length;
              const starHits = maxStars > 0 ? stars.filter(s => draw.stars && draw.stars.includes(s)).length : 0;

              const prize = this.calculateDrawPrize(hits, starHits, draw, combo);
              totalWon += prize;

              let catLabel = `${hits} aciertos`;
              if (maxStars > 0) {
                  const starName = this.currentGame.id === 'eurodreams' ? 'sueño' : (this.currentGame.id === 'gordo' ? 'clave' : 'estrella');
                  catLabel = `${hits} nº + ${starHits} ${starName}${starHits !== 1 ? 's' : ''}`;
              }

              if (prize > 0 || hits >= 2 || (this.currentGame.id === 'gordo' && starHits > 0)) {
                  breakdownCounts[catLabel] = (breakdownCounts[catLabel] || 0) + 1;
              }
          }
      }

      // Finalizar backtesting financiero y volcar a UI
      if (btn) (btn as HTMLButtonElement).disabled = false;
      if (progressContainer) progressContainer.style.display = 'none';
      if (resultsDiv) resultsDiv.style.display = 'block';

      const elTotalDraws = document.getElementById('btTotalDraws');
      const elTicketPrice = document.getElementById('btTicketPrice');
      const elSpent = document.getElementById('btTotalSpent');
      const elWon = document.getElementById('btTotalWon');
      const elBalance = document.getElementById('btBalance');
      const elROI = document.getElementById('btROI');
      const elExpVal = document.getElementById('btExpectedValue');
      const elExpValAdvice = document.getElementById('btExpectedValueAdvice');
      const elHitsBreakdown = document.getElementById('btHitsBreakdownContainer');

      if (elTotalDraws) elTotalDraws.textContent = String(totalDraws);
      if (elTicketPrice) elTicketPrice.textContent = `${ticketPrice.toFixed(2)} €`;
      if (elSpent) elSpent.textContent = `${totalSpent.toFixed(2)} €`;
      if (elWon) elWon.textContent = `${totalWon.toFixed(2)} €`;

      const balance = totalWon - totalSpent;
      if (elBalance) {
          elBalance.textContent = `${balance >= 0 ? '+' : ''}${balance.toFixed(2)} €`;
          elBalance.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';
      }

      const roi = totalSpent > 0 ? (totalWon / totalSpent) * 100 : 0;
      if (elROI) {
          elROI.textContent = `${roi.toFixed(1)}%`;
          elROI.style.color = roi >= 100 ? 'var(--success)' : roi >= 20 ? '#d97706' : 'var(--danger)';
      }

      const expVal = balance / totalDraws;
      if (elExpVal) {
          elExpVal.textContent = `${expVal >= 0 ? '+' : ''}${expVal.toFixed(2)} € / sorteo`;
          elExpVal.style.color = expVal >= 0 ? 'var(--success)' : 'var(--danger)';
      }

      if (elExpValAdvice) {
          let adviceText = '';
          const randomPlayExp = -ticketPrice * 0.45;
          if (expVal > randomPlayExp) {
              adviceText = `✅ ¡Filtro Ganador! Tu esperanza matemática empírica (${expVal.toFixed(2)} €) es superior al promedio teórico de una jugada aleatoria (${randomPlayExp.toFixed(2)} €). Los filtros han recortado la ventaja de la casa.`;
          } else {
              adviceText = `⚠️ Tu nivel de retorno está por debajo de lo esperado. Intenta ajustar los filtros (como Markov, Sumas o Desviación) para optimizar la esperanza matemática empirica.`;
          }
          elExpValAdvice.textContent = adviceText;
      }

      if (elHitsBreakdown) {
          elHitsBreakdown.innerHTML = '';
          const sortedBreakdown = Object.entries(breakdownCounts)
              .sort((a, b) => {
                  const hitsA = parseInt(a[0]) || 0;
                  const hitsB = parseInt(b[0]) || 0;
                  return hitsB - hitsA;
              });

          if (sortedBreakdown.length === 0) {
              elHitsBreakdown.innerHTML = `<div style="color: var(--gray); font-style: italic; text-align: center; padding: 10px;">No se obtuvieron aciertos computables en este test con premio.</div>`;
          } else {
              let breakdownHTML = `<table class="validation-summary-table">
                  <tr>
                      <th>Categoría de Aciertos</th>
                      <th>Sorteos de Coincidencia</th>
                      <th>Probabilidad Empírica</th>
                  </tr>`;
              
              sortedBreakdown.forEach(([label, count]) => {
                  const prob = ((count / totalDraws) * 100).toFixed(2);
                  const isHighlight = count > 0 && !label.startsWith('0 ') && !label.startsWith('1 ') && !label.startsWith('2 nº + 0');
                  breakdownHTML += `
                      <tr class="${isHighlight ? 'row-highlight' : ''}">
                          <td><strong>${label}</strong></td>
                          <td>${count} veces</td>
                          <td>${prob}%</td>
                      </tr>`;
              });
              breakdownHTML += `</table>`;
              elHitsBreakdown.innerHTML = breakdownHTML;
          }
      }

      this.showToast('✅ ¡Backtesting completado con éxito!', 'success');
  }

}

// Global instance of the app
document.addEventListener('DOMContentLoaded', () => {
  new DataLotto49Advanced();
});

// FIX: Add an empty export to treat this file as a module.
export {};
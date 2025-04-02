document.addEventListener("DOMContentLoaded", function() {
    // ===== VARIABLES GLOBALES =====
    let cues = [];
    let currentAudioFile = null;
    const MAX_WORD_LENGTH = 25;
    let holdTimeout = null; // Temporizador para tap-hold
    const HOLD_DURATION = 500; // ms para considerar tap-hold
    let lastPlayerHeight = 0; // Para ajustar padding del body
    const definitionCache = new Map(); // Caché para definiciones
    let interactionActionInProgress = false; // Flag para evitar doble acción (click + contextmenu/hold)

    // ===== ELEMENTOS DEL DOM =====
    // (Igual que antes: audioPlayer, subtitleContainer, dictionaryContainer, etc.)
    const audioPlayer = document.getElementById("audioPlayer");
    const subtitleContainer = document.getElementById("subtitleContainer");
    const dictionaryContainer = document.getElementById("dictionaryContainer");
    const floatingDictionary = document.getElementById("floatingDictionary");
    const floatingDictionaryContent = document.getElementById("floatingDictionaryContent");
    const loadingOverlay = document.getElementById("loadingOverlay");
    const initialDictMessage = document.querySelector('.initial-dict-message');

    const customPlayer = document.querySelector('.custom-player');
    const playPauseBtn = document.querySelector('.btn-play-pause');
    const prevBtn = document.querySelector('.btn-prev');
    const nextBtn = document.querySelector('.btn-next');
    const repeatBtn = document.querySelector('.btn-repeat');
    const timeline = document.querySelector('.timeline');
    const currentTimeSpan = document.querySelector('.current-time');
    const totalDurationSpan = document.querySelector('.total-duration');
    const volumeControl = document.getElementById('volumeControl');
    const playerTitle = document.querySelector('.custom-player .title');
    const playerArtist = document.querySelector('.custom-player .artist');
    const speedItems = document.querySelectorAll('.speed-item');

    const audioFileInput = document.getElementById("audioFile");
    const vttFileInput = document.getElementById("vttFile");
    const audioFileStatus = document.getElementById("audioFileStatus");
    const vttFileStatus = document.getElementById("vttFileStatus");
    const btnSepia = document.getElementById("btnSepia");
    const btnRose = document.getElementById("btnRose");
    const btnDark = document.getElementById("btnDark");
    const closeFloatDictButton = document.querySelector('.close-float-dict');

    // ===== FUNCIONES =====

    // --- Funciones de Utilidad (Igual que antes) ---
    function showLoading(show = true) {
        if (show) {
            loadingOverlay.classList.add('show');
        } else {
            setTimeout(() => loadingOverlay.classList.remove('show'), 150);
        }
    }
    function timeStringToSeconds(timeString) { /* ... */ }
    function formatTime(seconds) { /* ... */ }
    function isMobile() { /* ... */ }
    function showFileStatus(element, message, isSuccess = true) { /* ... */ }
    function adjustBodyPadding() { /* ... */ }

    // --- Funciones de Carga y Parseo (Igual que antes) ---
    async function parseVTT(vttText) { /* ... (Se mantiene lógica anterior) */ }
    function renderCues(parsedCues, container) { /* ... (Se mantiene lógica anterior) */ }

    // --- Funciones del Diccionario (MODIFICADO CON CACHÉ) ---
    async function fetchDefinition(word) {
        const cleanedWord = word.trim().toLowerCase()
            .replace(/^[.,!?;:"“”'`()\[\]{}]+|[.,!?;:"“”'`()\[\]{}]+$/g, '')
            .replace(/['’]s$/, '');

        if (!cleanedWord || cleanedWord.length === 0 || cleanedWord.length > MAX_WORD_LENGTH || !/^[a-z'-]+$/i.test(cleanedWord)) {
            console.warn("Palabra inválida para búsqueda:", word, `(Limpiada: ${cleanedWord})`);
            return { word: word, error: `No se puede buscar "${word}". Intenta con una palabra más simple.` };
        }

        // *** Revisar Caché ***
        if (definitionCache.has(cleanedWord)) {
            console.log(`Cache hit for: "${cleanedWord}"`);
            return definitionCache.get(cleanedWord);
        }
        console.log(`Cache miss for: "${cleanedWord}". Fetching...`);

        try {
            // 1. Obtener Definición (DictionaryAPI)
            // ... (Lógica fetch API igual que antes) ...
            const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanedWord}`);
            let dictData = null;
            if (dictResponse.ok) {
                const apiResult = await dictResponse.json();
                dictData = apiResult[0];
            } else if (dictResponse.status !== 404) {
                console.error("Error API Diccionario:", dictResponse.status, await dictResponse.text());
            } else {
                console.log(`Definición no encontrada para "${cleanedWord}" (404)`);
            }

            // 2. Obtener Traducción (MyMemory)
            // ... (Lógica fetch API igual que antes) ...
            let translation = null;
            try {
                 const transResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|es`);
                 if (transResponse.ok) {
                     const transData = await transResponse.json();
                     if (transData.responseStatus === 200 && transData.responseData?.translatedText) {
                         if (transData.responseData.translatedText.toLowerCase() !== word.toLowerCase() && !transData.responseData.translatedText.includes("NO QUERY SPECIFIED")) {
                              translation = transData.responseData.translatedText;
                         }
                     }
                 } else {
                     console.error("Error API Traducción:", transResponse.status);
                 }
             } catch (transError) {
                 console.error("Error fetching traducción:", transError);
             }


            // 3. Combinar y devolver resultados
            let resultData;
            if (dictData || translation) {
                 resultData = {
                    word: dictData?.word || cleanedWord,
                    translation: translation,
                    definitions: dictData
                };
                 // *** Guardar en Caché (SOLO si no hay error) ***
                 definitionCache.set(cleanedWord, resultData);
                 console.log(`Cached definition for: "${cleanedWord}"`);
            } else {
                 resultData = { word: cleanedWord, error: `No se encontró definición ni traducción para "${cleanedWord}".` };
                 // No guardar errores en caché
            }
            return resultData;

        } catch (error) {
            console.error("Error general en fetchDefinition:", error);
             // No guardar errores en caché
            return { word: cleanedWord, error: "Ocurrió un error al buscar la definición." };
        }
    }

    // Funciones createDefinitionHTML, displayDefinitionDesktop, displayDefinitionMobile, hideFloatingDictionary
    // se mantienen igual que antes.
    function createDefinitionHTML(data) { /* ... (Se mantiene lógica anterior) */ }
    function displayDefinitionDesktop(data) { /* ... (Se mantiene lógica anterior) */ }
    function displayDefinitionMobile(data) { /* ... (Se mantiene lógica anterior) */ }
    function hideFloatingDictionary() { /* ... (Se mantiene lógica anterior) */ }

    // --- Funciones del Reproductor de Audio (Igual que antes) ---
    function updatePlayerUI(state) { /* ... */ }
    function highlightCurrentWord() { /* ... */ }
    function updateTimeline() { /* ... */ }
    function setupAudioPlayer() { /* ... */ }
    function resetPlayer() { /* ... */ }

    // --- Cambio de Tema (Igual que antes) ---
    function switchTheme(theme) { /* ... */ }

    // --- Inicialización ---
    function initialize() {
         setupAudioPlayer();

         // Cargar tema preferido
         const preferredTheme = localStorage.getItem('preferredTheme') || 'sepia';
         switchTheme(preferredTheme);

        // --- EVENT LISTENERS (MODIFICADOS) ---

        // Carga de Archivos (Listeners audioFileInput, vttFileInput se mantienen igual)
        audioFileInput.addEventListener("change", /* ... (igual que antes) */);
        vttFileInput.addEventListener("change", /* ... (igual que antes) */);

        // Controles del Reproductor (Listeners playPauseBtn, prevBtn, nextBtn, etc. se mantienen igual)
        playPauseBtn.addEventListener('click', /* ... */ );
        prevBtn.addEventListener('click', /* ... */ );
        nextBtn.addEventListener('click', /* ... */ );
        repeatBtn.addEventListener('click', /* ... */ );
        timeline.addEventListener('input', /* ... */ );
        timeline.addEventListener('change', /* ... */ );
        document.querySelector('.dropdown-menu').addEventListener('click', /* ... (control velocidad) */);
        volumeControl.addEventListener('input', /* ... */ );

        // --- Interacción con Subtítulos (LÓGICA INVERTIDA) ---

        // Clic Izquierdo / Tap Corto (AHORA: Saltar Reproducción)
        subtitleContainer.addEventListener("click", (event) => {
            // Si una acción de menú contextual o tap-hold acaba de ocurrir, no hagas nada.
            if (interactionActionInProgress) {
                interactionActionInProgress = false; // Resetea el flag
                return;
            }

            if (event.target.tagName === "SPAN" && event.target.dataset.start) {
                const targetSpan = event.target;
                // Prevenir acción si estaba en proceso de hold (aunque el flag debería bastar)
                 if (targetSpan.classList.contains('holding')) {
                    return;
                 }

                 // Lógica de salto de reproducción
                 if (!audioPlayer.src || audioPlayer.readyState < audioPlayer.HAVE_METADATA) return;
                 const start = parseFloat(targetSpan.dataset.start);
                 if (!isNaN(start)) {
                     console.log("Click/Tap: Jumping to", start);
                     audioPlayer.currentTime = start;
                     if (audioPlayer.paused) {
                         audioPlayer.play().catch(e => console.error("Play error:", e));
                     }
                     // Opcional: Ocultar diccionario si estaba abierto
                     hideFloatingDictionary();
                 }
            }
        });

        // Clic Derecho (AHORA: Mostrar Definición - Escritorio)
        subtitleContainer.addEventListener("contextmenu", async (event) => {
            if (event.target.tagName === "SPAN" && event.target.dataset.start) {
                event.preventDefault();
                interactionActionInProgress = true; // Establece el flag para evitar el click

                const targetSpan = event.target;
                const word = targetSpan.textContent;

                // Quitar feedback visual de palabra clickeada anteriormente
                subtitleContainer.querySelectorAll('.word-loading').forEach(el => el.classList.remove('word-loading'));
                targetSpan.classList.add('word-loading'); // Añadir feedback visual
                showLoading(true); // Mostrar overlay

                try {
                    const definitionData = await fetchDefinition(word); // Usa la función con caché
                    if (definitionData) {
                        // Solo mostrar en escritorio con clic derecho
                        if (!isMobile()) {
                             displayDefinitionDesktop(definitionData);
                             dictionaryContainer.scrollTop = 0; // Scroll al inicio
                        } else {
                            // En móvil, el clic derecho no debería ocurrir, pero por si acaso...
                             hideFloatingDictionary(); // Asegurar que esté oculto
                        }
                    }
                } catch (error) {
                    console.error("Error displaying definition (contextmenu):", error);
                    const errorData = { word: word, error: error.message || "Error al mostrar definición." };
                    if (!isMobile()) displayDefinitionDesktop(errorData);
                } finally {
                    showLoading(false);
                    targetSpan.classList.remove('word-loading'); // Quitar feedback
                    // El flag 'interactionActionInProgress' se resetea en el listener de click
                }
            }
        });

         // Tap-Hold (AHORA: Mostrar Definición - Móvil)
        subtitleContainer.addEventListener('touchstart', (event) => {
            if (event.target.tagName === "SPAN" && event.target.dataset.start) {
                const targetSpan = event.target;
                targetSpan.classList.add('holding'); // Feedback visual

                holdTimeout = setTimeout(async () => {
                    interactionActionInProgress = true; // Establece el flag para evitar el click
                    holdTimeout = null; // Limpiar timeout ID
                    targetSpan.classList.remove('holding'); // Quitar feedback hold antes de cargar

                    const word = targetSpan.textContent;

                    // Añadir feedback de carga
                     targetSpan.classList.add('word-loading');
                     showLoading(true);
                     hideFloatingDictionary(); // Ocultar previo si existe

                    try {
                        const definitionData = await fetchDefinition(word); // Usa la función con caché
                        if (definitionData) {
                            // Solo mostrar en móvil con tap-hold
                             if (isMobile()) {
                                 displayDefinitionMobile(definitionData);
                             }
                        }
                    } catch (error) {
                         console.error("Error displaying definition (tap-hold):", error);
                         const errorData = { word: word, error: error.message || "Error al mostrar definición." };
                         if (isMobile()) displayDefinitionMobile(errorData);
                    } finally {
                        showLoading(false);
                        targetSpan.classList.remove('word-loading');
                         // El flag 'interactionActionInProgress' se resetea en el listener de click
                    }

                }, HOLD_DURATION);
            }
        }, { passive: true }); // Cambiado a passive: true ya que no prevenimos scroll aquí

         // Limpiar estado y timeout si el toque termina, se cancela o se mueve
        const clearHoldState = (event) => {
             clearTimeout(holdTimeout);
             holdTimeout = null;
             if (event.target.tagName === "SPAN") {
                 event.target.classList.remove('holding'); // Quitar feedback visual de hold
             }
             // No quitar word-loading aquí, se quita al finalizar la carga de definición
        };
        subtitleContainer.addEventListener('touchend', clearHoldState);
        subtitleContainer.addEventListener('touchcancel', clearHoldState);
        subtitleContainer.addEventListener('touchmove', clearHoldState);


         // Cerrar diccionario flotante (Igual que antes)
         closeFloatDictButton.addEventListener('click', hideFloatingDictionary);

         // Reproducir pronunciación desde botones (Igual que antes)
         document.body.addEventListener('click', /* ... (igual que antes) */ );

        // Cambio de Tema (Igual que antes)
        btnSepia.addEventListener("click", () => switchTheme("sepia"));
        btnRose.addEventListener("click", () => switchTheme("rose"));
        btnDark.addEventListener("click", () => switchTheme("dark"));

        console.log("Lector Interactivo inicializado con interacción invertida y caché.");
    }

    // Iniciar la aplicación
    initialize();

}); // Fin de DOMContentLoaded
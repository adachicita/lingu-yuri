document.addEventListener("DOMContentLoaded", function() {
    // ===== VARIABLES GLOBALES =====
    let cues = [];
    let currentAudioFile = null;
    const MAX_WORD_LENGTH = 25;
    let holdTimeout = null; // Temporizador para tap-hold
    const HOLD_DURATION = 500; // ms para considerar tap-hold
    let lastPlayerHeight = 0; // Para ajustar padding del body

    // ===== ELEMENTOS DEL DOM =====
    const audioPlayer = document.getElementById("audioPlayer");
    const subtitleContainer = document.getElementById("subtitleContainer");
    const dictionaryContainer = document.getElementById("dictionaryContainer");
    const floatingDictionary = document.getElementById("floatingDictionary");
    const floatingDictionaryContent = document.getElementById("floatingDictionaryContent");
    const loadingOverlay = document.getElementById("loadingOverlay");
    const initialDictMessage = document.querySelector('.initial-dict-message'); // Mensaje inicial diccionario

    // Controles del Reproductor
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
    const speedItems = document.querySelectorAll('.speed-item'); // Selector para items de velocidad

    // Controles de Archivos y Temas
    const audioFileInput = document.getElementById("audioFile");
    const vttFileInput = document.getElementById("vttFile");
    const audioFileStatus = document.getElementById("audioFileStatus");
    const vttFileStatus = document.getElementById("vttFileStatus");
    const btnSepia = document.getElementById("btnSepia"); // Cambiado de btnLight
    const btnRose = document.getElementById("btnRose");
    const btnDark = document.getElementById("btnDark");
    const closeFloatDictButton = document.querySelector('.close-float-dict');

    // ===== FUNCIONES =====

    // --- Funciones de Utilidad ---
    function showLoading(show = true) {
        if (show) {
            loadingOverlay.classList.add('show');
        } else {
            // Pequeño retardo para asegurar que la transición se vea
            setTimeout(() => loadingOverlay.classList.remove('show'), 150);
        }
    }

    function timeStringToSeconds(timeString) {
        if (!timeString) return 0;
        // Soporta HH:MM:SS.ms, MM:SS.ms, SS.ms
        const parts = timeString.split(':').reverse(); // [ms.SS, MM, HH]
        let seconds = 0;
        if (parts[0]) seconds += parseFloat(parts[0].replace(',', '.')); // Segundos y milisegundos
        if (parts[1]) seconds += parseFloat(parts[1]) * 60; // Minutos
        if (parts[2]) seconds += parseFloat(parts[2]) * 3600; // Horas
        return isNaN(seconds) ? 0 : seconds;
    }

     function formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity || seconds < 0) {
            return "0:00";
        }
        const totalSeconds = Math.floor(seconds);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function isMobile() {
        // Considera móvil si la ventana es menor que el breakpoint lg de Bootstrap
        return window.innerWidth < 992;
    }

    // Función para mostrar mensajes de estado de archivos
    function showFileStatus(element, message, isSuccess = true) {
        if (!element) return;
        element.textContent = message;
        element.classList.remove('text-success', 'text-danger');
        element.classList.add(isSuccess ? 'text-success' : 'text-danger');
    }

    // Ajustar padding del body para que el reproductor no tape contenido
    function adjustBodyPadding() {
        const playerHeight = customPlayer.offsetHeight;
        if (playerHeight !== lastPlayerHeight) {
            document.body.style.paddingBottom = `${playerHeight + 15}px`; // 15px de margen extra
            // Ajustar posición del diccionario flotante
            floatingDictionary.style.bottom = `${playerHeight + 10}px`; // 10px sobre el player
            lastPlayerHeight = playerHeight;
        }
    }


    // --- Funciones de Carga y Parseo ---
    async function parseVTT(vttText) {
        // Implementación robusta de parseVTT (la anterior era bastante buena)
        // Se mantiene la lógica existente, verificando su robustez.
        // Asegurarse de que maneja correctamente diferentes formatos de fin de línea (\n, \r\n)
        // y posibles variaciones en el formato de tiempo.
        const lines = vttText.split(/\r?\n/);
        const parsedCues = [];
        let i = 0;
        let cue = null;

        while (i < lines.length) {
            let line = lines[i]?.trim();

            if (!line) { // Línea vacía, posible fin de cue
                if (cue) {
                    // Limpiar texto final del cue
                    cue.text = cue.text.trim().replace(/<[^>]+>/g, ''); // Limpiar tags HTML
                    if (cue.text) {
                        parsedCues.push(cue);
                    }
                    cue = null; // Resetear para el próximo cue
                }
                i++;
                continue;
            }

            // Ignorar cabecera, comentarios, estilos, regiones
            if (line.toUpperCase() === "WEBVTT" || line.toUpperCase().startsWith("NOTE") ||
                line.toUpperCase().startsWith("STYLE") || line.toUpperCase().startsWith("REGION")) {
                i++;
                continue;
            }

            // Intentar parsear línea de tiempo
            // 00:00:00.000 --> 00:00:00.000 (con/sin horas)
            // Puede tener ajustes de posición al final (ignorarlos por ahora)
            const timeMatch = line.match(/^([\d:.,]+)\s+-->\s+([\d:.,]+)/);
            if (timeMatch) {
                 if (cue) { // Si había un cue anterior sin línea vacía, guardarlo
                    cue.text = cue.text.trim().replace(/<[^>]+>/g, '');
                     if (cue.text) parsedCues.push(cue);
                 }

                const start = timeStringToSeconds(timeMatch[1]);
                const end = timeStringToSeconds(timeMatch[2]);

                if (!isNaN(start) && !isNaN(end) && end > start) {
                    cue = { start, end, text: "" };
                } else {
                    console.warn("Formato de tiempo inválido encontrado:", line);
                    cue = null; // Invalidar este cue
                }
                i++;
                continue;
            }

            // Si no es tiempo y tenemos un cue activo, es parte del texto
            if (cue) {
                // Manejar múltiples líneas de texto para un cue
                cue.text += (cue.text ? " " : "") + line;
            } else if (/^\d+$/.test(line)) {
                 // Es un identificador de cue numérico (ignorarlo si no sigue un tiempo)
                 // A menudo viene *antes* del tiempo, así que no hacemos nada especial aquí.
            } else {
                // Podría ser un identificador no numérico o texto inesperado, loguear si es necesario
                // console.log("Línea ignorada:", line);
            }

            i++;
        }
         // Añadir el último cue si existe
         if (cue && cue.text.trim()) {
             cue.text = cue.text.trim().replace(/<[^>]+>/g, '');
             parsedCues.push(cue);
         }

        console.log(`Parsed ${parsedCues.length} cues.`);
        return parsedCues;
    }


    function renderCues(parsedCues, container) {
        container.innerHTML = ""; // Limpiar
        if (!parsedCues || parsedCues.length === 0) {
            container.innerHTML = '<p class="text-muted initial-message">No se encontraron subtítulos válidos o el archivo está vacío.</p>';
            return;
        }
        let fragment = document.createDocumentFragment();
        parsedCues.forEach(cue => {
            // Separar por palabras y espacios manteniendo los espacios
            const parts = cue.text.split(/(\s+)/);
            parts.forEach(part => {
                if (part.trim().length > 0) { // Es una palabra
                    const span = document.createElement("span");
                    span.textContent = part;
                    span.dataset.start = cue.start;
                    span.dataset.end = cue.end;
                    // Añadir tabindex para accesibilidad (opcional)
                    // span.setAttribute('tabindex', '0');
                    fragment.appendChild(span);
                } else if (part.length > 0) { // Es un espacio o salto de línea
                    fragment.appendChild(document.createTextNode(part));
                }
            });
            // Añadir un espacio entre cues para separación visual si no termina ya en uno
            if (fragment.lastChild && fragment.lastChild.nodeType === Node.ELEMENT_NODE) {
                 fragment.appendChild(document.createTextNode(" "));
            }
        });
        container.appendChild(fragment); // Añadir todo de una vez para mejor rendimiento
    }

     // --- Funciones del Diccionario ---
    async function fetchDefinition(word) {
        // Limpieza más robusta de la palabra
        const cleanedWord = word.trim().toLowerCase()
                                .replace(/^[.,!?;:"“”'`()\[\]{}]+|[.,!?;:"“”'`()\[\]{}]+$/g, '') // Quitar puntuación al inicio/final
                                .replace(/['’]s$/,''); // Quitar 's posesivo común

        if (!cleanedWord || cleanedWord.length === 0 || cleanedWord.length > MAX_WORD_LENGTH || !/^[a-z'-]+$/i.test(cleanedWord)) {
            console.warn("Palabra inválida para búsqueda:", word, `(Limpiada: ${cleanedWord})`);
            // Devolver un error específico para mostrar en UI
            return { word: word, error: `No se puede buscar "${word}". Intenta con una palabra más simple.` };
        }

        console.log("Buscando:", cleanedWord);
        try {
            // 1. Obtener Definición (DictionaryAPI)
            const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanedWord}`);
            let dictData = null;
            if (dictResponse.ok) {
                const apiResult = await dictResponse.json();
                dictData = apiResult[0]; // Usualmente devuelve un array
            } else if (dictResponse.status !== 404) {
                console.error("Error API Diccionario:", dictResponse.status, await dictResponse.text());
                 // Podríamos intentar traducción igualmente
            } else {
                console.log(`Definición no encontrada para "${cleanedWord}" (404)`);
            }

            // 2. Obtener Traducción (MyMemory - como fallback o complemento)
            let translation = null; // Empezar con null
            try {
                 // Usar la palabra original (sin limpiar tanto) para traducción podría ser mejor
                const transResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|es`);
                if (transResponse.ok) {
                    const transData = await transResponse.json();
                    if (transData.responseStatus === 200 && transData.responseData?.translatedText) {
                         // Validar que no sea la misma palabra o un placeholder
                        if (transData.responseData.translatedText.toLowerCase() !== word.toLowerCase() && !transData.responseData.translatedText.includes("NO QUERY SPECIFIED")) {
                             translation = transData.responseData.translatedText;
                        }
                    } else {
                         // console.warn("Respuesta traducción no exitosa:", transData);
                    }
                } else {
                    console.error("Error API Traducción:", transResponse.status);
                }
            } catch (transError) {
                console.error("Error fetching traducción:", transError);
            }

            // 3. Combinar y devolver resultados
            if (dictData || translation) {
                return {
                    word: dictData?.word || cleanedWord, // Usar la palabra de la API si existe
                    translation: translation,
                    definitions: dictData // Puede ser null
                };
            } else {
                 // Ni definición encontrada (404) ni traducción válida
                 return { word: cleanedWord, error: `No se encontró definición ni traducción para "${cleanedWord}".` };
            }

        } catch (error) {
            console.error("Error general en fetchDefinition:", error);
            return { word: cleanedWord, error: "Ocurrió un error al buscar la definición." };
        }
    }

    // Refactorizar: Crear HTML de definición común
    function createDefinitionHTML(data) {
        let contentHTML = "";
         if (data.error) {
            contentHTML = `
                <div class="definition-error p-2">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i> ${data.error}
                </div>`;
        } else {
            const phoneticAudio = data.definitions?.phonetics?.find(p => p.audio)?.audio;
            const phoneticText = data.definitions?.phonetics?.find(p => p.text)?.text;

            contentHTML = `
                <div class="definition-card mb-0"> <div class="definition-header">
                        <div>
                            <span class="definition-word">${data.word}</span>
                             ${phoneticText ? `<span class="phonetic-text ms-2 text-muted">${phoneticText}</span>` : ''}
                            ${data.translation ? `<div class="translation">${data.translation}</div>` : ''}
                        </div>
                         ${phoneticAudio ? `
                             <button class="btn btn-sm btn-outline-secondary play-pronunciation-btn flex-shrink-0" data-audio-src="${phoneticAudio}" title="Escuchar pronunciación">
                                 <i class="bi bi-volume-up"></i>
                             </button>
                         ` : ''}
                    </div>
            `;
            if (data.definitions && data.definitions.meanings && data.definitions.meanings.length > 0) {
                contentHTML += `<div class="definition-content">`;
                data.definitions.meanings.forEach((meaning, index) => {
                    // Mostrar máximo 2 'meanings' en flotante, más en escritorio?
                    if (!isMobile() || index < 2) {
                        contentHTML += `
                            <div class="meaning-section ${index > 0 ? 'mt-3' : ''}">
                                <div class="part-of-speech">${meaning.partOfSpeech}</div>
                                <ul class="definitions-list">
                        `;
                        // Mostrar máximo 3 definiciones por 'meaning'
                        meaning.definitions.slice(0, 3).forEach(def => {
                            contentHTML += `
                                <li class="definition-item">
                                    <div class="definition-text">${def.definition}</div>
                                    ${def.example ? `
                                    <div class="example">
                                        <i class="bi bi-chat-right-quote"></i>
                                        <em>${def.example}</em>
                                    </div>` : ''}
                                </li>
                            `;
                        });
                        contentHTML += `</ul></div>`;
                    }
                });
                if (isMobile() && data.definitions.meanings.length > 2) {
                    contentHTML += `<div class="text-muted small mt-2">Más definiciones disponibles en escritorio.</div>`;
                }
                 contentHTML += `</div>`; // Cierre definition-content
            } else if (!data.translation) {
                 contentHTML += `<div class="definition-content text-muted p-3">No se encontraron definiciones detalladas.</div>`;
            } else {
                // Solo traducción, el header ya la muestra.
                contentHTML += `<div class="definition-content text-muted p-3 small">Definiciones detalladas no disponibles.</div>`;
            }
            contentHTML += `</div>`; // Cierre definition-card
        }
        return contentHTML;
    }

    function displayDefinitionDesktop(data) {
        dictionaryContainer.innerHTML = createDefinitionHTML(data);
        // Ocultar mensaje inicial si existe
        if (initialDictMessage) initialDictMessage.style.display = 'none';
    }

    function displayDefinitionMobile(data) {
        floatingDictionaryContent.innerHTML = createDefinitionHTML(data);
        floatingDictionary.classList.add('show');
        adjustBodyPadding(); // Reajustar por si el diccionario cambia la altura necesaria
    }

     function hideFloatingDictionary() {
         floatingDictionary.classList.remove('show');
     }

    // --- Funciones del Reproductor de Audio ---
    function updatePlayerUI(state) {
        switch (state) {
            case 'play':
                playPauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                playPauseBtn.title = "Pausar";
                break;
            case 'pause':
            case 'end':
            case 'reset':
            default:
                playPauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
                 playPauseBtn.title = "Reproducir";
                break;
        }
    }

    function highlightCurrentWord() {
        if (!audioPlayer || audioPlayer.paused || cues.length === 0) {
            // Quitar highlight si no hay audio, está pausado o no hay cues
            subtitleContainer.querySelectorAll("span.highlight").forEach(span => {
                span.classList.remove("highlight");
            });
            return; // Salir si no hay nada que resaltar
        }

        const currentTime = audioPlayer.currentTime;
        let activeCueFound = false;
        let firstHighlightedSpan = null; // Para scroll

        subtitleContainer.querySelectorAll("span[data-start]").forEach(span => {
            const start = parseFloat(span.dataset.start);
            const end = parseFloat(span.dataset.end);
            // Añadir un pequeño margen (ej. 0.1s) para que el highlight cambie un poco antes
            const shouldHighlight = currentTime >= (start - 0.1) && currentTime < end;

            if (shouldHighlight) {
                span.classList.add("highlight");
                if (!activeCueFound) {
                    firstHighlightedSpan = span;
                    activeCueFound = true;
                }
            } else {
                span.classList.remove("highlight");
            }
        });

        // Scroll a la palabra activa si es necesario
        if (firstHighlightedSpan) {
            const spanRect = firstHighlightedSpan.getBoundingClientRect();
            const containerRect = subtitleContainer.getBoundingClientRect();
             // Comprobar si está total o parcialmente fuera de la vista verticalmente
            if (spanRect.top < containerRect.top || spanRect.bottom > containerRect.bottom) {
                firstHighlightedSpan.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center', // Centrar verticalmente
                    inline: 'nearest' // Scroll horizontal mínimo
                });
            }
        }
    }

     function updateTimeline() {
        if (!audioPlayer || isNaN(audioPlayer.duration)) return; // Salir si no hay duración válida

        const currentTime = audioPlayer.currentTime;
        const duration = audioPlayer.duration;

        timeline.value = Math.floor(currentTime);
        currentTimeSpan.textContent = formatTime(currentTime);

        // Actualizar highlight aquí es crucial
        highlightCurrentWord();
    }

    function setupAudioPlayer() {
        resetPlayer();

        audioPlayer.addEventListener('loadedmetadata', () => {
            const duration = audioPlayer.duration;
             if (!isNaN(duration) && duration > 0) {
                totalDurationSpan.textContent = formatTime(duration);
                timeline.max = Math.floor(duration);
                timeline.disabled = false;
                console.log("Audio metadata loaded. Duration:", formatTime(duration));
             } else {
                 console.warn("Audio duration invalid:", duration);
                 totalDurationSpan.textContent = "N/A";
                 timeline.max = 100;
                 timeline.value = 0;
                 timeline.disabled = true;
             }
            showLoading(false);
            adjustBodyPadding(); // Ajustar padding una vez cargado
        });

         audioPlayer.addEventListener('error', (e) => {
             console.error("Error en Audio Player:", e);
             const errorMsg = `Error: ${e.target.error?.message || 'No se pudo cargar el audio.'}`;
             playerTitle.textContent = "Error de audio";
             playerArtist.textContent = "Intenta otro archivo";
             showFileStatus(audioFileStatus, errorMsg, false);
             alert(`Error al cargar el archivo de audio.\n${errorMsg}\nAsegúrate de que sea un MP3 válido.`);
             showLoading(false);
             resetPlayer();
         });

        audioPlayer.addEventListener('timeupdate', updateTimeline);
        audioPlayer.addEventListener('play', () => updatePlayerUI('play'));
        audioPlayer.addEventListener('pause', () => updatePlayerUI('pause'));
        audioPlayer.addEventListener('ended', () => {
            updatePlayerUI('end');
            if (!audioPlayer.loop) {
                // No resetear currentTime aquí, permite volver a reproducir desde el final
                // audioPlayer.currentTime = 0;
                timeline.value = Math.floor(audioPlayer.duration || 0); // Llevar al final
                // Quitar highlight al finalizar si no está en loop
                 subtitleContainer.querySelectorAll("span.highlight").forEach(span => span.classList.remove("highlight"));
            }
        });

        // Cargar y aplicar ajustes guardados
        const savedVolume = localStorage.getItem('playerVolume');
        if (savedVolume !== null) {
            const volume = parseFloat(savedVolume);
            audioPlayer.volume = volume;
            volumeControl.value = volume;
        } else {
            audioPlayer.volume = 1; // Valor por defecto si no hay nada guardado
            volumeControl.value = 1;
        }

        const savedSpeed = localStorage.getItem('playerSpeed');
        if (savedSpeed !== null) {
            const speed = parseFloat(savedSpeed);
            audioPlayer.playbackRate = speed;
            // Actualizar botón activo en el menú
            speedItems.forEach(item => {
                item.classList.toggle('active', parseFloat(item.getAttribute('data-speed')) === speed);
            });
        } else {
            audioPlayer.playbackRate = 1; // Valor por defecto
             speedItems.forEach(item => { // Asegurar que 1x esté activo por defecto
                 item.classList.toggle('active', parseFloat(item.getAttribute('data-speed')) === 1);
             });
        }

         // Aplicar estado activo al botón de repetir si es necesario
         repeatBtn.classList.toggle('active', audioPlayer.loop);
         repeatBtn.title = audioPlayer.loop ? 'Repetición Activada' : 'Repetir';

         // Ajustar padding del body inicialmente y en resize
         adjustBodyPadding();
         window.addEventListener('resize', adjustBodyPadding); // Reajustar en resize
    }

     function resetPlayer() {
        audioPlayer.pause();
        // Liberar URL anterior para evitar memory leaks
        if (currentAudioFile && currentAudioFile.url) {
             URL.revokeObjectURL(currentAudioFile.url);
             console.log("Revoked old audio URL:", currentAudioFile.url);
         }
        audioPlayer.removeAttribute('src'); // Quitar fuente
        audioPlayer.load(); // Forzar reseteo del estado interno
        currentAudioFile = null;

        timeline.value = 0;
        timeline.max = 100;
        timeline.disabled = true;
        currentTimeSpan.textContent = "0:00";
        totalDurationSpan.textContent = "0:00";
        playerTitle.textContent = "Carga un audio";
        playerArtist.textContent = "Archivo no cargado";
        updatePlayerUI('reset');
        subtitleContainer.innerHTML = '<p class="text-muted initial-message">Carga un archivo de audio y un archivo VTT para comenzar.</p>';
        cues = [];
        if (initialDictMessage) initialDictMessage.style.display = 'block'; // Mostrar mensaje inicial diccionario
        dictionaryContainer.innerHTML = ''; // Limpiar contenido diccionario
        dictionaryContainer.appendChild(initialDictMessage); // Reinsertar mensaje inicial
        hideFloatingDictionary();
        audioFileStatus.textContent = ''; // Limpiar estado archivo audio
        vttFileStatus.textContent = ''; // Limpiar estado archivo VTT
        audioFileInput.value = ''; // Limpiar input audio
        vttFileInput.value = ''; // Limpiar input vtt
    }

    // --- Cambio de Tema ---
    function switchTheme(theme) {
        document.body.className = `theme-${theme}`; // Reemplaza todas las clases del body
        localStorage.setItem('preferredTheme', theme);
        console.log("Switched theme to:", theme);
        // Podrías querer actualizar los botones activos del menú aquí también
    }

    // --- Inicialización ---
    function initialize() {
         setupAudioPlayer(); // Configura listeners del player

         // Cargar tema preferido
         const preferredTheme = localStorage.getItem('preferredTheme') || 'sepia'; // Sepia por defecto
         switchTheme(preferredTheme);

        // --- EVENT LISTENERS ---

        // Carga de Archivos
        audioFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith("audio/")) {
                 // Resetear player y VTT antes de cargar nuevo audio
                 resetPlayer();
                showLoading(true); // Mostrar loading *antes* de crear URL

                const url = URL.createObjectURL(file);
                currentAudioFile = { name: file.name, url: url };
                audioPlayer.src = url;
                // La carga real la dispara el evento 'loadedmetadata' configurado en setupAudioPlayer
                playerTitle.textContent = file.name.replace(/\.[^/.]+$/, "");
                playerArtist.textContent = "Archivo Local";
                showFileStatus(audioFileStatus, `"${file.name}" cargado.`, true);
                 // No se oculta el loading aquí, se hace en 'loadedmetadata' o 'error'
                 // Resetear estado VTT
                 vttFileStatus.textContent = '';
                 vttFileInput.value = '';
                 subtitleContainer.innerHTML = '<p class="text-muted initial-message">Ahora carga el archivo de subtítulos (VTT).</p>';

            } else if (file) {
                 const errorMsg = "Archivo no válido. Selecciona un archivo de audio (MP3 preferiblemente).";
                 showFileStatus(audioFileStatus, errorMsg, false);
                 alert(errorMsg);
                 e.target.value = '';
                 resetPlayer(); // Resetear si el archivo fue inválido
            } else {
                // No se seleccionó archivo (canceló)
                // showFileStatus(audioFileStatus, "Carga cancelada.", false); // Opcional
            }
        });

        vttFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
             // Verificar que haya un audio cargado primero
            if (!currentAudioFile) {
                 alert("Primero carga un archivo de audio.");
                 e.target.value = ''; // Limpiar input
                 return;
             }

            if (file && file.name.toLowerCase().endsWith(".vtt")) {
                showLoading(true);
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const vttData = event.target.result;
                        cues = await parseVTT(vttData);
                        renderCues(cues, subtitleContainer);
                        if (cues.length > 0) {
                            showFileStatus(vttFileStatus, `"${file.name}" (${cues.length} cues) cargado.`, true);
                        } else {
                             showFileStatus(vttFileStatus, `"${file.name}" cargado, pero no se encontraron cues válidos.`, false);
                        }
                    } catch (error) {
                         console.error("Error al parsear VTT:", error);
                         const errorMsg = `Error al leer VTT: ${error.message}`;
                         showFileStatus(vttFileStatus, errorMsg, false);
                         subtitleContainer.innerHTML = `<p class="text-danger initial-message">${errorMsg}</p>`;
                         cues = [];
                         alert(`Error procesando el archivo VTT:\n${error.message}`);
                    } finally {
                        showLoading(false);
                    }
                };
                reader.onerror = () => {
                    const errorMsg = "Error fatal al leer el archivo VTT.";
                    alert(errorMsg);
                    showFileStatus(vttFileStatus, errorMsg, false);
                     subtitleContainer.innerHTML = `<p class="text-danger initial-message">No se pudo leer el archivo VTT.</p>`;
                     cues = [];
                    showLoading(false);
                };
                reader.readAsText(file);
            } else if (file) {
                const errorMsg = "Archivo no válido. Selecciona un archivo .vtt";
                 alert(errorMsg);
                 showFileStatus(vttFileStatus, errorMsg, false);
                 e.target.value = ''; // Limpiar input
            } else {
                // Carga cancelada
                // showFileStatus(vttFileStatus, "Carga cancelada.", false); // Opcional
            }
        });

        // Controles del Reproductor
        playPauseBtn.addEventListener('click', () => {
            if (!audioPlayer.src || audioPlayer.readyState < audioPlayer.HAVE_METADATA) {
                console.log("Audio no listo para play/pause");
                return;
            }
            if (audioPlayer.paused || audioPlayer.ended) {
                audioPlayer.play().catch(e => console.error("Play error:", e));
            } else {
                audioPlayer.pause();
            }
        });

        prevBtn.addEventListener('click', () => {
             if (!audioPlayer.src || audioPlayer.readyState < audioPlayer.HAVE_METADATA) return;
            audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
            updateTimeline(); // Forzar actualización visual inmediata
        });

        nextBtn.addEventListener('click', () => {
            if (!audioPlayer.src || audioPlayer.readyState < audioPlayer.HAVE_METADATA) return;
            audioPlayer.currentTime = Math.min(audioPlayer.duration || 0, audioPlayer.currentTime + 10);
             updateTimeline(); // Forzar actualización visual inmediata
        });

        repeatBtn.addEventListener('click', () => {
            audioPlayer.loop = !audioPlayer.loop;
            repeatBtn.classList.toggle('active', audioPlayer.loop); // Usar clase 'active' para estilo
             repeatBtn.title = audioPlayer.loop ? 'Repetición Activada' : 'Repetir';
            console.log("Loop toggled:", audioPlayer.loop);
        });

        timeline.addEventListener('input', () => {
             if (!audioPlayer.src || audioPlayer.readyState < audioPlayer.HAVE_METADATA || timeline.disabled) return;

            // Actualizar el tiempo visualmente mientras se arrastra
            currentTimeSpan.textContent = formatTime(timeline.value);

             // No pausar mientras se arrastra, solo actualizar currentTime al soltar (o en 'change')
             // Esto da una experiencia más fluida
        });
        // Usar 'change' para confirmar el salto de tiempo al soltar la barra
        timeline.addEventListener('change', () => {
            if (!audioPlayer.src || audioPlayer.readyState < audioPlayer.HAVE_METADATA || timeline.disabled) return;
            audioPlayer.currentTime = timeline.value;
            // Si estaba pausado, forzar actualización del highlight en la nueva posición
             if (audioPlayer.paused) {
                 highlightCurrentWord();
             }
        });


         // Control de velocidad
         document.querySelector('.dropdown-menu').addEventListener('click', (e) => {
             const target = e.target.closest('.speed-item'); // Buscar el item correcto
             if (target) {
                 e.preventDefault();
                 if (!audioPlayer.src || audioPlayer.readyState < 1) return;

                 const speed = parseFloat(target.getAttribute('data-speed'));
                 audioPlayer.playbackRate = speed;
                 localStorage.setItem('playerSpeed', speed); // Guardar preferencia

                 // Actualizar estado activo
                 speedItems.forEach(item => item.classList.remove('active'));
                 target.classList.add('active');
                 console.log("Speed changed to:", speed);
             }
         });


        volumeControl.addEventListener('input', () => {
            const volume = volumeControl.value;
            audioPlayer.volume = volume;
            localStorage.setItem('playerVolume', volume); // Guardar preferencia
            // Actualizar icono de volumen (opcional) - requeriría más lógica
        });

        // --- Interacción con Subtítulos ---

        // Clic Izquierdo / Tap Corto (Mostrar Definición)
        subtitleContainer.addEventListener("click", async (event) => {
            if (event.target.tagName === "SPAN" && event.target.dataset.start) {
                // Prevenir acción si fue un tap-hold (gestionado en touchstart/touchend)
                if (event.target.classList.contains('holding')) {
                    return;
                }

                // Quitar feedback visual de palabra clickeada anteriormente
                subtitleContainer.querySelectorAll('.word-loading').forEach(el => el.classList.remove('word-loading'));

                hideFloatingDictionary();
                const word = event.target.textContent;
                const targetSpan = event.target;

                targetSpan.classList.add('word-loading'); // Añadir feedback visual inmediato
                showLoading(true); // Mostrar overlay general

                 try {
                    const definitionData = await fetchDefinition(word);
                    if (definitionData) {
                        if (isMobile()) {
                            displayDefinitionMobile(definitionData);
                        } else {
                            displayDefinitionDesktop(definitionData);
                            // Scroll al panel derecho si es necesario (opcional)
                            dictionaryContainer.scrollTop = 0;
                        }
                    }
                 } catch (error) { // Captura errores de fetchDefinition si los lanza explícitamente
                    console.error("Error displaying definition:", error);
                    const errorData = { word: word, error: error.message || "Error al mostrar definición." };
                     if (isMobile()) displayDefinitionMobile(errorData);
                     else displayDefinitionDesktop(errorData);
                 } finally {
                     showLoading(false);
                     targetSpan.classList.remove('word-loading'); // Quitar feedback
                 }
            }
        });

         // Clic Derecho (Reproducir desde palabra - Escritorio)
        subtitleContainer.addEventListener("contextmenu", (event) => {
            if (event.target.tagName === "SPAN" && event.target.dataset.start) {
                event.preventDefault();
                 if (!audioPlayer.src || audioPlayer.readyState < audioPlayer.HAVE_METADATA) return;
                const start = parseFloat(event.target.dataset.start);
                 if (!isNaN(start)) {
                    console.log("Context menu: Jumping to", start);
                    audioPlayer.currentTime = start;
                    if (audioPlayer.paused) {
                         audioPlayer.play().catch(e => console.error("Play error:", e));
                    }
                    hideFloatingDictionary(); // Ocultar si estaba abierto
                 }
            }
        });

         // Tap-Hold (Reproducir desde palabra - Móvil)
        subtitleContainer.addEventListener('touchstart', (event) => {
            if (event.target.tagName === "SPAN" && event.target.dataset.start) {
                 // Prevenir scroll mientras se mantiene pulsado
                 // event.preventDefault(); // CUIDADO: Esto puede prevenir el scroll normal de la página

                const targetSpan = event.target;
                targetSpan.classList.add('holding'); // Añadir clase para feedback visual

                // Iniciar temporizador para detectar hold
                holdTimeout = setTimeout(() => {
                    if (!audioPlayer.src || audioPlayer.readyState < audioPlayer.HAVE_METADATA) return;
                    const start = parseFloat(targetSpan.dataset.start);
                    if (!isNaN(start)) {
                        console.log("Tap-hold: Jumping to", start);
                        audioPlayer.currentTime = start;
                         if (audioPlayer.paused) {
                             audioPlayer.play().catch(e => console.error("Play error:", e));
                         }
                        hideFloatingDictionary(); // Ocultar si estaba abierto
                    }
                    // El flag 'holding' se quita en touchend/touchcancel
                     holdTimeout = null; // Limpiar timeout ID
                }, HOLD_DURATION);
            }
        }, { passive: false }); // Necesario passive: false para poder prevenir default si se usa

        subtitleContainer.addEventListener('touchend', (event) => {
            clearTimeout(holdTimeout); // Cancelar temporizador si el toque termina antes
             holdTimeout = null;
             if (event.target.tagName === "SPAN") {
                 event.target.classList.remove('holding'); // Quitar feedback visual
             }
             // Permitir que el evento 'click' se dispare normalmente si no fue un hold largo
        });

        subtitleContainer.addEventListener('touchcancel', (event) => {
             clearTimeout(holdTimeout);
             holdTimeout = null;
             if (event.target.tagName === "SPAN") {
                 event.target.classList.remove('holding');
             }
        });
         subtitleContainer.addEventListener('touchmove', (event) => {
             // Cancelar hold si el dedo se mueve significativamente
             clearTimeout(holdTimeout);
             holdTimeout = null;
             if (event.target.tagName === "SPAN") {
                 event.target.classList.remove('holding');
             }
        });


         // Cerrar diccionario flotante
         closeFloatDictButton.addEventListener('click', hideFloatingDictionary);

         // Reproducir pronunciación desde botones en diccionarios
         document.body.addEventListener('click', (e) => {
             const button = e.target.closest('.play-pronunciation-btn');
             if (button && button.dataset.audioSrc) {
                 // Crear y reproducir audio efímero
                 const pronunciationAudio = new Audio(button.dataset.audioSrc);
                 pronunciationAudio.play()
                    .then(() => console.log("Playing pronunciation:", button.dataset.audioSrc))
                    .catch(err => console.error("Error playing pronunciation:", err));
             }
         });


        // Cambio de Tema
        btnSepia.addEventListener("click", () => switchTheme("sepia"));
        btnRose.addEventListener("click", () => switchTheme("rose"));
        btnDark.addEventListener("click", () => switchTheme("dark"));

        console.log("Lector Interactivo inicializado.");
    }

    // Iniciar la aplicación
    initialize();

}); // Fin de DOMContentLoaded
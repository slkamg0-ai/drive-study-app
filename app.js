/**
 * Drive Learn (드라이브 런) - Neumorphic Soft UI Study Logic
 * Full Multi-Format Support: PDF, CSV, TXT, JSON, and Direct Paste!
 */

(function () {
  'use strict';

  // --- Storage Keys ---
  const STORAGE_KEYS = {
    DATASET_ID: 'dl_neu_dataset_id_v2',
    LAST_INDEX: 'dl_neu_last_index_v2',
    FILTER: 'dl_neu_filter_v2',
    SETTINGS: 'dl_neu_settings_v2',
    BOOKMARKS: 'dl_neu_bookmarks_v2',
    CUSTOM_DATASETS: 'dl_neu_custom_datasets_v2'
  };

  // --- Default Settings ---
  const defaultSettings = {
    readMode: 'CORE',       // 'CORE' (문제->정답->해설), 'FULL' (문제->보기->정답->해설), 'ANSWER_ONLY'
    rate: 1.0,              // 0.9 ~ 1.3
    thinkingPause: 3,       // 초
    nextPause: 2,           // 초
    voiceURI: '',
    geminiKey: '',
    autoAi: true
  };

  // --- State ---
  let state = {
    datasets: {
      DEFAULT: {
        id: 'DEFAULT',
        title: '측량및지형공간정보기사',
        subtitle: '2017년 3월 5일 필기 기출문제',
        questions: []
      }
    },
    activeDatasetId: 'DEFAULT',
    allQuestions: [],
    filteredQuestions: [],
    currentIndex: 0,
    isPlaying: false,
    currentPhase: 'idle',
    thinkingTimer: null,
    nextTimer: null,
    wakeLock: null,
    settings: { ...defaultSettings },
    bookmarks: new Set(),
    activeFilter: 'ALL'
  };

  // Configure pdf.js worker
  if (typeof window.pdfjsLib !== 'undefined') {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  }

  // --- DOM Elements ---
  const elements = {
    topTitleBadge: document.getElementById('top-title-badge'),
    btnTopPrev: document.getElementById('btn-top-prev'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    resumeBanner: document.getElementById('resume-banner'),
    resumeMsg: document.getElementById('resume-msg'),
    btnDismissResume: document.getElementById('btn-dismiss-resume'),
    // Cover Card
    coverSubjectBadge: document.getElementById('cover-subject-badge'),
    coverQnum: document.getElementById('cover-qnum'),
    coverAudioWave: document.getElementById('cover-audio-wave'),
    coverStatusText: document.getElementById('cover-status-text'),
    // Book Info & Action
    examTitle: document.getElementById('exam-title'),
    examSubjectDetail: document.getElementById('exam-subject-detail'),
    examMeta: document.getElementById('exam-meta'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    playIcon: document.getElementById('play-icon'),
    playText: document.getElementById('play-text'),
    btnBookmark: document.getElementById('btn-bookmark'),
    bookmarkIcon: document.getElementById('bookmark-icon'),
    // Main Content Card
    qProgressTag: document.getElementById('q-progress-tag'),
    voiceStatusPill: document.getElementById('voice-status-pill'),
    questionText: document.getElementById('question-text'),
    optionsList: document.getElementById('options-list'),
    answerRevealBox: document.getElementById('answer-reveal-box'),
    answerBadgeText: document.getElementById('answer-badge-text'),
    explanationText: document.getElementById('explanation-text'),
    aiExpBadge: document.getElementById('ai-exp-badge'),
    aiExpPromptBanner: document.getElementById('ai-exp-prompt-banner'),
    btnBannerGemini: document.getElementById('btn-banner-gemini'),
    // Bottom Dock
    btnDockSubject: document.getElementById('btn-dock-subject'),
    btnPrev: document.getElementById('btn-prev'),
    btnReplay: document.getElementById('btn-replay'),
    btnNext: document.getElementById('btn-next'),
    btnOpenFiles: document.getElementById('btn-open-files'),
    toastContainer: document.getElementById('toast-container'),
    // Modals
    modalSettings: document.getElementById('modal-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    settingReadMode: document.getElementById('setting-read-mode'),
    settingSpeechRate: document.getElementById('setting-speech-rate'),
    settingThinkingPause: document.getElementById('setting-thinking-pause'),
    settingNextPause: document.getElementById('setting-next-pause'),
    settingVoiceSelect: document.getElementById('setting-voice-select'),
    settingGeminiKey: document.getElementById('setting-gemini-key'),
    settingAutoAi: document.getElementById('setting-auto-ai'),
    btnGeminiAi: document.getElementById('btn-gemini-ai'),
    btnBatchGemini: document.getElementById('btn-batch-gemini'),
    modalSubject: document.getElementById('modal-subject'),
    btnCloseSubject: document.getElementById('btn-close-subject'),
    subjectFilterSelect: document.getElementById('subject-filter-select'),
    btnApplySubject: document.getElementById('btn-apply-subject'),
    modalFiles: document.getElementById('modal-files'),
    btnCloseFiles: document.getElementById('btn-close-files'),
    btnRestoreDefault: document.getElementById('btn-restore-default'),
    activeDatasetSelect: document.getElementById('active-dataset-select'),
    fileInputPdf: document.getElementById('file-input-pdf'),
    fileInputCsv: document.getElementById('file-input-csv'),
    fileInputTxt: document.getElementById('file-input-txt'),
    pasteTextInput: document.getElementById('paste-text-input'),
    btnParsePasteText: document.getElementById('btn-parse-paste-text'),
    btnDownloadCsvSample: document.getElementById('btn-download-csv-sample'),
    btnDownloadSample: document.getElementById('btn-download-sample'),
    btnResetData: document.getElementById('btn-reset-data'),
    // Explanation Edit Modal
    btnEditExp: document.getElementById('btn-edit-exp'),
    modalEditExp: document.getElementById('modal-edit-exp'),
    btnCloseEditExp: document.getElementById('btn-close-edit-exp'),
    btnSaveEditExp: document.getElementById('btn-save-edit-exp'),
    editExpQlabel: document.getElementById('edit-exp-qlabel'),
    editExpTextarea: document.getElementById('edit-exp-textarea'),
    // Gemini Setup Modal
    modalGeminiSetup: document.getElementById('modal-gemini-setup'),
    btnCloseGeminiSetup: document.getElementById('btn-close-gemini-setup'),
    inputGeminiKeySetup: document.getElementById('input-gemini-key-setup'),
    btnSaveGeminiKey: document.getElementById('btn-save-gemini-key')
  };

  // --- Web Audio Chime Synth ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSoftChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now);
      osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.2);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.55);
      osc2.stop(now + 0.55);
    } catch (e) {}
  }

  // --- Screen Wake Lock ---
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        state.wakeLock = await navigator.wakeLock.request('screen');
        state.wakeLock.addEventListener('release', () => {
          if (state.isPlaying) requestWakeLock();
        });
      } catch (err) {}
    }
  }

  document.addEventListener('visibilitychange', async () => {
    if (state.wakeLock !== null && document.visibilityState === 'visible' && state.isPlaying) {
      await requestWakeLock();
    }
  });

  // --- Toast Helper ---
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  }

  // --- LocalStorage Persistence ---
  function loadPersistedState() {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) state.settings = { ...defaultSettings, ...JSON.parse(savedSettings) };
    } catch (e) {}

    try {
      const savedBookmarks = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      if (savedBookmarks) state.bookmarks = new Set(JSON.parse(savedBookmarks));
    } catch (e) {}

    try {
      const savedDatasets = localStorage.getItem(STORAGE_KEYS.CUSTOM_DATASETS);
      if (savedDatasets) Object.assign(state.datasets, JSON.parse(savedDatasets));
    } catch (e) {}

    const savedDatasetId = localStorage.getItem(STORAGE_KEYS.DATASET_ID);
    if (savedDatasetId && state.datasets[savedDatasetId]) {
      state.activeDatasetId = savedDatasetId;
    }

    const savedFilter = localStorage.getItem(STORAGE_KEYS.FILTER);
    if (savedFilter) state.activeFilter = savedFilter;
  }

  function saveCurrentState() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify([...state.bookmarks]));
      localStorage.setItem(STORAGE_KEYS.DATASET_ID, state.activeDatasetId);
      localStorage.setItem(STORAGE_KEYS.FILTER, state.activeFilter);
      
      const currentQ = getCurrentQuestion();
      if (currentQ) {
        localStorage.setItem(STORAGE_KEYS.LAST_INDEX, currentQ.id.toString());
      }
    } catch (e) {}
  }

  // --- Voice Synthesis (TTS) ---
  let speechVoices = [];
  function populateVoiceList() {
    if (!('speechSynthesis' in window)) return;
    speechVoices = window.speechSynthesis.getVoices();
    elements.settingVoiceSelect.innerHTML = '<option value="DEFAULT">시스템 기본 한국어 음성</option>';
    
    const koVoices = speechVoices.filter(v => v.lang.startsWith('ko') || v.lang.includes('KR'));
    koVoices.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})`;
      if (v.voiceURI === state.settings.voiceURI) opt.selected = true;
      elements.settingVoiceSelect.appendChild(opt);
    });
  }

  if ('speechSynthesis' in window) {
    populateVoiceList();
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  function speakText(text, onEndCallback) {
    if (!('speechSynthesis' in window)) {
      if (onEndCallback) setTimeout(onEndCallback, 1500);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/①|②|③|④/g, (m) => ` ${m.replace('①','1번 ').replace('②','2번 ').replace('③','3번 ').replace('④','4번 ')} `)
      .replace(/m2/g, '제곱미터')
      .replace(/m3/g, '세제곱미터')
      .replace(/≒/g, '약')
      .replace(/±/g, '플러스마이너스 ')
      .replace(/λ/g, '람다')
      .replace(/Δ/g, '델타')
      .replace(/°/g, '도 ')
      .replace(/′/g, '분 ')
      .replace(/″/g, '초 ')
      .replace(/\//g, ' 나누기 ')
      .replace(/×/g, ' 곱하기 ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ko-KR';
    utterance.rate = parseFloat(state.settings.rate) || 1.0;
    utterance.pitch = 1.0;

    if (state.settings.voiceURI) {
      const foundVoice = speechVoices.find(v => v.voiceURI === state.settings.voiceURI);
      if (foundVoice) utterance.voice = foundVoice;
    } else {
      const defaultKo = speechVoices.find(v => v.lang.startsWith('ko') || v.lang.includes('KR'));
      if (defaultKo) utterance.voice = defaultKo;
    }

    let finished = false;
    const finishHandler = () => {
      if (!finished) {
        finished = true;
        if (onEndCallback && state.isPlaying) onEndCallback();
      }
    };

    utterance.onend = finishHandler;
    utterance.onerror = finishHandler;

    window.speechSynthesis.speak(utterance);
  }

  function stopAllSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    clearTimeout(state.thinkingTimer);
    clearTimeout(state.nextTimer);
    state.currentPhase = 'idle';
    elements.coverAudioWave.classList.remove('playing');
  }

  // --- Filtering & Active Question Helpers ---
  function applyFilter() {
    const rawList = state.datasets[state.activeDatasetId]?.questions || [];
    state.allQuestions = rawList;

    if (state.activeFilter === 'ALL') {
      state.filteredQuestions = [...rawList];
    } else if (state.activeFilter === 'BOOKMARK') {
      state.filteredQuestions = rawList.filter(q => state.bookmarks.has(q.id));
    } else {
      state.filteredQuestions = rawList.filter(q => q.subject && q.subject.includes(state.activeFilter));
    }

    if (state.filteredQuestions.length === 0) {
      state.currentIndex = 0;
    } else if (state.currentIndex >= state.filteredQuestions.length) {
      state.currentIndex = state.filteredQuestions.length - 1;
    }
  }

  function getCurrentQuestion() {
    if (state.filteredQuestions.length === 0) return null;
    return state.filteredQuestions[state.currentIndex];
  }

  // --- Render UI ---
  function renderCard(revealAnswer = false) {
    const q = getCurrentQuestion();
    const dataset = state.datasets[state.activeDatasetId] || {};

    if (!q) {
      elements.coverQnum.textContent = 'Q.--';
      elements.coverSubjectBadge.textContent = '종료';
      elements.coverStatusText.textContent = '문제 없음';
      elements.examTitle.textContent = dataset.title || '문제집';
      elements.examSubjectDetail.textContent = '목록이 비어있습니다.';
      elements.qProgressTag.textContent = '0 / 0';
      elements.voiceStatusPill.textContent = '대기 중';
      elements.questionText.textContent = state.activeFilter === 'BOOKMARK'
        ? '저장된 북마크 문제가 없습니다. 🔖 버튼으로 중요한 문제를 추가해 보세요.'
        : '해당 과목에 문제가 없습니다.';
      elements.optionsList.innerHTML = '';
      elements.answerRevealBox.style.display = 'none';
      return;
    }

    // 1. Cover Card (Left)
    const formattedNum = q.id < 10 ? `Q.0${q.id}` : `Q.${q.id}`;
    elements.coverQnum.textContent = formattedNum;
    
    const subjectMatch = q.subject ? q.subject.match(/(\d과목)/) : null;
    elements.coverSubjectBadge.textContent = subjectMatch ? subjectMatch[1] : '문제';

    // Top Bar Badge
    elements.topTitleBadge.textContent = dataset.title || '기출문제 카드';

    // 2. Info Card (Right)
    elements.examTitle.textContent = dataset.title || '기출문제';
    elements.examSubjectDetail.textContent = q.subject ? q.subject.replace(/^\d과목\s*:\s*/, '') : '시험 문제';
    elements.examMeta.textContent = `문제 ${state.currentIndex + 1} / ${state.filteredQuestions.length}`;

    // 3. Middle Reading Card
    elements.qProgressTag.textContent = `No. ${q.id} (${state.currentIndex + 1}/${state.filteredQuestions.length})`;
    elements.questionText.textContent = q.question;

    // Options rendering
    elements.optionsList.innerHTML = '';
    if (q.options && q.options.length > 0) {
      q.options.forEach((optText, idx) => {
        const optNum = idx + 1;
        const optDiv = document.createElement('div');
        optDiv.className = 'neu-option-item';
        optDiv.textContent = optText;

        if (revealAnswer && optNum === q.answer) {
          optDiv.classList.add('correct');
        }

        optDiv.addEventListener('click', () => {
          if (!state.isPlaying) {
            renderCard(true);
            if (optNum === q.answer) {
              playSoftChime();
              showToast('정답입니다! 👏');
            } else {
              optDiv.classList.add('wrong');
              showToast(`오답입니다. 정답은 ${q.answer}번입니다.`);
            }
          }
        });

        elements.optionsList.appendChild(optDiv);
      });
    }

    // Answer & Explanation
    if (revealAnswer) {
      elements.answerRevealBox.style.display = 'block';
      elements.answerBadgeText.textContent = q.answerText || `${q.answer}번`;
      elements.explanationText.textContent = q.explanation || '해설이 준비되어 있지 않습니다.';

      const isShallow = isPlaceholderExplanation(q.explanation);
      if (elements.aiExpBadge) {
        elements.aiExpBadge.style.display = (q.isAiGenerated || (!isShallow && (q.explanation || '').length > 40)) ? 'inline-block' : 'none';
      }
      if (elements.aiExpPromptBanner) {
        elements.aiExpPromptBanner.style.display = isShallow ? 'block' : 'none';
      }
    } else {
      elements.answerRevealBox.style.display = 'none';
    }

    // Bookmark status
    if (state.bookmarks.has(q.id)) {
      elements.btnBookmark.classList.add('bookmarked');
      elements.bookmarkIcon.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
    } else {
      elements.btnBookmark.classList.remove('bookmarked');
      elements.bookmarkIcon.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
    }

    saveCurrentState();
  }

  function updateStatus(phase, text, isPlayingWave = false) {
    elements.voiceStatusPill.className = `q-phase-badge ${phase}`;
    elements.voiceStatusPill.textContent = text;
    elements.coverStatusText.textContent = text;
    if (isPlayingWave) {
      elements.coverAudioWave.classList.add('playing');
    } else {
      elements.coverAudioWave.classList.remove('playing');
    }
  }

  // --- Auto-Playback Engine ---
  function startStudyCycle() {
    const q = getCurrentQuestion();
    if (!q) {
      pausePlayback();
      return;
    }

    requestWakeLock();
    getAudioContext();

    renderCard(false);

    if (state.settings.readMode === 'ANSWER_ONLY') {
      stepRevealAndAnswer(q);
      return;
    }

    state.currentPhase = 'question';
    updateStatus('speaking', '문제 낭독 중', true);

    let speechText = `${q.id}번 문제. ${q.question}`;
    if (state.settings.readMode === 'FULL' && q.options && q.options.length > 0) {
      speechText += '. 보기. ' + q.options.join('. ');
    }

    speakText(speechText, () => {
      if (!state.isPlaying) return;
      stepThinking(q);
    });
  }

  function stepThinking(q) {
    const pauseSec = parseInt(state.settings.thinkingPause) || 0;
    if (pauseSec <= 0) {
      stepRevealAndAnswer(q);
      return;
    }

    state.currentPhase = 'thinking';
    let remain = pauseSec;
    updateStatus('thinking', `생각 시간 (${remain}초)`, false);

    state.thinkingTimer = setInterval(() => {
      remain--;
      if (!state.isPlaying) {
        clearInterval(state.thinkingTimer);
        return;
      }
      if (remain > 0) {
        updateStatus('thinking', `생각 시간 (${remain}초)`, false);
      } else {
        clearInterval(state.thinkingTimer);
        stepRevealAndAnswer(q);
      }
    }, 1000);
  }

  async function stepRevealAndAnswer(q) {
    state.currentPhase = 'answer';
    renderCard(true);
    playSoftChime();

    // Auto AI Explanation if enabled and key is set
    if (state.settings.autoAi && state.settings.geminiKey && isPlaceholderExplanation(q.explanation)) {
      updateStatus('thinking', '✨ AI 해설 생성 중...', false);
      elements.explanationText.textContent = '✨ Gemini AI가 문제와 정답을 분석하여 전문 해설을 생성하고 있습니다...';
      try {
        await callGeminiForQuestion(q, true);
      } catch (e) {
        console.error('Auto AI generation error:', e);
      }
    }

    if (!state.isPlaying) return;

    updateStatus('revealed', '정답 및 해설', true);

    const answerSpeech = `정답은 ${q.answerText || q.answer + '번'} 입니다. 해설. ${q.explanation || ''}`;

    speakText(answerSpeech, () => {
      if (!state.isPlaying) return;
      stepNextDelay();
    });
  }

  function stepNextDelay() {
    state.currentPhase = 'waiting_next';
    const nextPauseSec = parseInt(state.settings.nextPause) || 2;
    updateStatus('revealed', `${nextPauseSec}초 후 다음`, false);

    state.nextTimer = setTimeout(() => {
      if (!state.isPlaying) return;
      if (state.currentIndex < state.filteredQuestions.length - 1) {
        state.currentIndex++;
        startStudyCycle();
      } else {
        showToast('🎉 모든 문제 학습이 완료되었습니다!');
        pausePlayback();
        updateStatus('idle', '완료', false);
      }
    }, nextPauseSec * 1000);
  }

  function startPlayback() {
    state.isPlaying = true;
    elements.btnPlayPause.classList.add('playing');
    elements.playIcon.textContent = '❚❚';
    elements.playText.textContent = 'Pause';
    startStudyCycle();
  }

  function pausePlayback() {
    state.isPlaying = false;
    elements.btnPlayPause.classList.remove('playing');
    elements.playIcon.textContent = '▶';
    elements.playText.textContent = 'Read';
    stopAllSpeech();
    updateStatus('idle', '대기 중', false);
  }

  function togglePlayPause() {
    if (state.isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function goToNext() {
    stopAllSpeech();
    if (state.currentIndex < state.filteredQuestions.length - 1) {
      state.currentIndex++;
    } else {
      showToast('마지막 문제입니다.');
    }
    if (state.isPlaying) {
      startStudyCycle();
    } else {
      renderCard(false);
    }
  }

  function goToPrev() {
    stopAllSpeech();
    if (state.currentIndex > 0) {
      state.currentIndex--;
    } else {
      showToast('첫 번째 문제입니다.');
    }
    if (state.isPlaying) {
      startStudyCycle();
    } else {
      renderCard(false);
    }
  }

  function replayCurrent() {
    stopAllSpeech();
    if (state.isPlaying) {
      startStudyCycle();
    } else {
      renderCard(false);
      startPlayback();
    }
  }

  function toggleBookmark() {
    const q = getCurrentQuestion();
    if (!q) return;

    if (state.bookmarks.has(q.id)) {
      state.bookmarks.delete(q.id);
      showToast(`${q.id}번 문제 북마크 해제`);
    } else {
      state.bookmarks.add(q.id);
      showToast(`${q.id}번 문제 북마크 저장 🔖`);
    }
    saveCurrentState();
    renderCard(elements.answerRevealBox.style.display === 'block');
  }

  // --- Multi-Format File Parsers ---

  // 1. PDF File Parser (Client-Side pdf.js)
  async function parsePdfFile(file) {
    showToast('📄 PDF 문서 분석 중입니다...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer, disableFontFace: true }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const str = textContent.items.map(it => it.str).join(' ');
        fullText += `\n---PAGE_${i}---\n` + str;
      }

      const title = file.name.replace(/\.[^/.]+$/, '');
      const parsedQuestions = parseExamTextFromPDF(fullText);

      if (parsedQuestions.length === 0) {
        alert('PDF에서 문제를 추출하지 못했습니다. 스캔 이미지 전용 PDF인 경우 OCR 변환 후 시도해 주세요.');
        return;
      }

      addNewDataset(title, parsedQuestions);
      showToast(`🎉 PDF에서 ${parsedQuestions.length}개 문제를 성공적으로 등록했습니다!`);

      // Prompt to auto-generate AI explanations if PDF lacks explanations
      const sampleHasExp = parsedQuestions.some(q => q.explanation && !isPlaceholderExplanation(q.explanation));
      if (!sampleHasExp) {
        setTimeout(() => {
          if (state.settings.geminiKey) {
            if (confirm(`📄 PDF 기출문제 ${parsedQuestions.length}문제를 등록했습니다!\n\n💡 이 시험지에는 문제와 정답만 있고 상세 해설이 없습니다.\nGoogle Gemini AI로 전체 문제의 전문 해설을 지금 바로 자동 완성하시겠습니까?\n(약 20~30초 소요, 취소 시 개별 문제마다 자동 생성)`)) {
              callGeminiBatch();
            }
          } else {
            if (confirm(`📄 PDF 기출문제 ${parsedQuestions.length}문제를 등록했습니다!\n\n💡 이 시험지에는 상세 해설이 없습니다.\nGoogle Gemini AI 키를 연동하면 AI가 모든 문제의 전문 해설을 실시간 분석 및 생성해 드립니다.\n지금 무료 Gemini API 키를 등록하시겠습니까?`)) {
              openGeminiSetupModal();
            }
          }
        }, 500);
      }
    } catch (err) {
      alert('PDF 분석 오류: ' + err.message);
    }
  }

  function parseExamTextFromPDF(fullText) {
    // 1. Extract Answer Table (typically 100 answers at the end of CBT papers)
    const answerMap = {};
    const ansTokens = fullText.match(/[①②③④]/g) || [];
    if (ansTokens.length >= 100) {
      const last100 = ansTokens.slice(-100);
      const circleMap = { '①': 1, '②': 2, '③': 3, '④': 4 };
      last100.forEach((sym, idx) => {
        answerMap[idx + 1] = circleMap[sym] || 1;
      });
    }

    // 2. Extract Questions
    const questions = [];
    const qBlocks = [];
    const qRegex = /(\d{1,3})\s*\.\s+([\s\S]*?)(?=(?:\d{1,3}\s*\.\s+|$))/g;
    let match;
    const seen = new Set();

    while ((match = qRegex.exec(fullText)) !== null) {
      const qId = parseInt(match[1]);
      if (qId >= 1 && qId <= 150 && !seen.has(qId)) {
        seen.add(qId);
        qBlocks.push({ id: qId, raw: match[2] });
      }
    }

    for (const item of qBlocks) {
      let raw = item.raw
        .replace(/전자문제집\s*CBT[\s\S]*?www\.comcbt\.com/g, '')
        .replace(/최강\s*자격증[\s\S]*?www\.comcbt\.com/g, '');

      // Separate question from options
      const optIdx = raw.search(/[①1\(\[]\s*[\s\S]*?[②2\(\[]/);
      let qText = raw;
      let options = [];

      if (optIdx !== -1) {
        qText = raw.substring(0, optIdx).trim();
        const optPart = raw.substring(optIdx);
        const parts = optPart.split(/[①②③④]/).map(s => s.trim()).filter(Boolean);
        if (parts.length >= 4) {
          options = [
            `① ${parts[0]}`,
            `② ${parts[1]}`,
            `③ ${parts[2]}`,
            `④ ${parts[3]}`
          ];
        }
      }

      if (options.length === 0) {
        options = ["① 보기 1", "② 보기 2", "③ 보기 3", "④ 보기 4"];
      }

      const ansNum = answerMap[item.id] || 1;
      const ansOptionText = options[ansNum - 1] 
        ? options[ansNum - 1].replace(/^[①②③④\d\.\)\s]+/, '').trim() 
        : '';
      const ansText = ansOptionText ? `${ansNum}번 (${ansOptionText})` : `${ansNum}번`;

      // 1) 해설 텍스트가 PDF 원문에 존재하는지 검사 ([해설], [풀이], 해설: 등)
      let explanation = '';
      const expMatch = raw.match(/(?:\[\s*(?:해설|풀이|정답과\s*해설|정답및해설|오답노트|오답피하기|참고)\s*\]|해설\s*[:\.]|풀이\s*[:\.]|※\s*해설|★\s*해설)\s*([\s\S]*?)$/i);
      if (expMatch && expMatch[1].trim().length > 3) {
        explanation = expMatch[1].trim();
      }

      // 2) 해설이 없는 시험지 PDF일 경우: 지능형 음성 해설 자동 생성 루틴
      if (!explanation) {
        explanation = generateSmartExplanation(qText, options, ansNum);
      }

      let subj = "기출과목";
      if (item.id <= 20) subj = "1과목";
      else if (item.id <= 40) subj = "2과목";
      else if (item.id <= 60) subj = "3과목";
      else if (item.id <= 80) subj = "4과목";
      else subj = "5과목";

      questions.push({
        id: item.id,
        subject: subj,
        question: qText.trim(),
        options: options,
        answer: ansNum,
        answerText: ansText,
        explanation: explanation
      });
    }

    questions.sort((a, b) => a.id - b.id);
    return questions;
  }

  // 지능형 음성 해설 생성기 (해설 텍스트가 없는 PDF 대응)
  function generateSmartExplanation(qText, options, ansNum) {
    const isNegative = /(?:옳지\s*않은|틀린|아닌|거리\s*가\s*먼|해당하지\s*않는|불가능한|없는)/.test(qText);
    const ansOptionText = options[ansNum - 1] 
      ? options[ansNum - 1].replace(/^[①②③④\d\.\)\s]+/, '').trim() 
      : `${ansNum}번`;

    if (isNegative) {
      const otherOpts = options
        .filter((_, idx) => idx !== (ansNum - 1))
        .map(o => o.replace(/^[①②③④\d\.\)\s]+/, '').trim())
        .slice(0, 2);
      return `정답은 ${ansNum}번, '${ansOptionText}' 입니다. 문제에서 옳지 않거나 틀린 설명을 묻고 있으므로 ${ansNum}번이 오답에 해당합니다. [✨ AI 해설] 버튼을 누르면 Gemini AI가 핵심 원리와 함정 분석을 실시간 생성해 드립니다.`;
    } else {
      return `정답은 ${ansNum}번, '${ansOptionText}' 입니다. 문제의 조건과 출제 의도에 가장 올바르게 부합하는 정답입니다. [✨ AI 해설] 버튼을 누르면 Gemini AI가 계산 공식과 해설을 실시간 분석해 드립니다.`;
    }
  }

  // 2. CSV File Parser
  function parseCsvFile(content, fileName) {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const questions = [];
    let startIdx = 0;
    
    // Check if line 0 is a header (e.g. contains '문제')
    if (lines[0].includes('문제')) {
      startIdx = 1;
    }

    let autoId = 1;
    for (let i = startIdx; i < lines.length; i++) {
      // Split by comma taking quotes into account
      const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
      if (cols.length < 2) continue;

      const qText = cols[0];
      const opt1 = cols[1] || '보기 1';
      const opt2 = cols[2] || '보기 2';
      const opt3 = cols[3] || '보기 3';
      const opt4 = cols[4] || '보기 4';
      const ansRaw = cols[5] || '1';
      const expText = cols[6] || '';

      let ansNum = parseInt(ansRaw.match(/\d/)?.[0] || '1');
      if (ansNum < 1 || ansNum > 4) ansNum = 1;

      const options = [
        opt1.startsWith('①') ? opt1 : `① ${opt1}`,
        opt2.startsWith('②') ? opt2 : `② ${opt2}`,
        opt3.startsWith('③') ? opt3 : `③ ${opt3}`,
        opt4.startsWith('④') ? opt4 : `④ ${opt4}`
      ];

      questions.push({
        id: autoId++,
        subject: "기출문제",
        question: qText,
        options: options,
        answer: ansNum,
        answerText: options[ansNum - 1],
        explanation: expText || `정답은 ${ansNum}번입니다.`
      });
    }

    if (questions.length > 0) {
      const title = fileName.replace(/\.[^/.]+$/, '');
      addNewDataset(title, questions);
      showToast(`📊 CSV에서 ${questions.length}개 문제를 등록했습니다!`);
    } else {
      alert('CSV 형식을 인식하지 못했습니다. 샘플 CSV 양식을 확인해 주세요.');
    }
  }

  // 3. Plain Text Parser
  function parsePlainText(rawText) {
    const blocks = rawText.split(/(?:---|===|\n\s*\n\s*\n)/).map(b => b.trim()).filter(Boolean);
    const result = [];
    let autoId = 1;

    blocks.forEach((block) => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      let question = '';
      let answer = '';
      let explanation = '';
      const options = [];

      lines.forEach((line) => {
        if (/^(?:문제|Q|\d+[\.\)])\s*[:\.]?\s*/i.test(line)) {
          question = line.replace(/^(?:문제|Q|\d+[\.\)])\s*[:\.]?\s*/i, '').trim();
        } else if (/^(?:답|정답|Answer|A)\s*[:\.]?\s*/i.test(line)) {
          answer = line.replace(/^(?:답|정답|Answer|A)\s*[:\.]?\s*/i, '').trim();
        } else if (/^(?:해설|풀이|설명|Exp)\s*[:\.]?\s*/i.test(line)) {
          explanation = line.replace(/^(?:해설|풀이|설명|Exp)\s*[:\.]?\s*/i, '').trim();
        } else if (/^[①②③④1-4\(\d\)]/.test(line)) {
          options.push(line);
        } else {
          if (!answer && !explanation) question += ' ' + line;
          else if (explanation) explanation += ' ' + line;
        }
      });

      if (question || answer) {
        let answerNum = 1;
        const numMatch = answer.match(/[1-4]|①|②|③|④/);
        if (numMatch) {
          const char = numMatch[0];
          if (char === '①' || char === '1') answerNum = 1;
          if (char === '②' || char === '2') answerNum = 2;
          if (char === '③' || char === '3') answerNum = 3;
          if (char === '④' || char === '4') answerNum = 4;
        }

        result.push({
          id: autoId++,
          subject: "사용자 추가 과목",
          question: question || "문제 내용 없음",
          options: options.length > 0 ? options : ["① 보기 1", "② 보기 2", "③ 보기 3", "④ 보기 4"],
          answer: answerNum,
          answerText: answer || `${answerNum}번`,
          explanation: explanation || "해설이 등록되지 않았습니다."
        });
      }
    });

    return result;
  }

  function addNewDataset(title, questions) {
    const newId = 'dataset_' + Date.now();
    state.datasets[newId] = {
      id: newId,
      title: title,
      subtitle: `${questions.length}문제 기출`,
      questions: questions
    };

    const customOnly = { ...state.datasets };
    delete customOnly.DEFAULT;
    localStorage.setItem(STORAGE_KEYS.CUSTOM_DATASETS, JSON.stringify(customOnly));

    state.activeDatasetId = newId;
    state.currentIndex = 0;
    applyFilter();
    renderCard(false);
    updateDatasetDropdown();
    elements.modalFiles.classList.remove('open');
  }

  function updateDatasetDropdown() {
    elements.activeDatasetSelect.innerHTML = '';
    Object.keys(state.datasets).forEach((id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = state.datasets[id].title;
      if (id === state.activeDatasetId) opt.selected = true;
      elements.activeDatasetSelect.appendChild(opt);
    });
  }

  // --- Setup Event Listeners ---
  function setupEventListeners() {
    elements.btnPlayPause.addEventListener('click', togglePlayPause);
    elements.btnBookmark.addEventListener('click', toggleBookmark);
    elements.btnTopPrev.addEventListener('click', goToPrev);
    elements.btnPrev.addEventListener('click', goToPrev);
    elements.btnNext.addEventListener('click', goToNext);
    elements.btnReplay.addEventListener('click', replayCurrent);

    // Settings Modal
    elements.btnOpenSettings.addEventListener('click', () => {
      elements.settingReadMode.value = state.settings.readMode;
      elements.settingSpeechRate.value = state.settings.rate.toString();
      elements.settingThinkingPause.value = state.settings.thinkingPause.toString();
      elements.settingNextPause.value = state.settings.nextPause.toString();
      if (elements.settingAutoAi) {
        elements.settingAutoAi.checked = state.settings.autoAi !== false;
      }
      if (elements.settingGeminiKey) {
        elements.settingGeminiKey.value = state.settings.geminiKey || '';
      }
      populateVoiceList();
      elements.modalSettings.classList.add('open');
    });

    elements.btnCloseSettings.addEventListener('click', () => {
      elements.modalSettings.classList.remove('open');
    });

    elements.btnSaveSettings.addEventListener('click', () => {
      state.settings.readMode = elements.settingReadMode.value;
      state.settings.rate = parseFloat(elements.settingSpeechRate.value);
      state.settings.thinkingPause = parseInt(elements.settingThinkingPause.value);
      state.settings.nextPause = parseInt(elements.settingNextPause.value);
      state.settings.voiceURI = elements.settingVoiceSelect.value;
      if (elements.settingAutoAi) {
        state.settings.autoAi = elements.settingAutoAi.checked;
      }
      if (elements.settingGeminiKey) {
        state.settings.geminiKey = elements.settingGeminiKey.value.trim();
      }
      saveCurrentState();
      elements.modalSettings.classList.remove('open');
      showToast('설정이 저장되었습니다.');
    });

    // Subject Filter Modal
    elements.btnDockSubject.addEventListener('click', () => {
      elements.subjectFilterSelect.value = state.activeFilter;
      elements.modalSubject.classList.add('open');
    });

    elements.btnCloseSubject.addEventListener('click', () => {
      elements.modalSubject.classList.remove('open');
    });

    elements.btnApplySubject.addEventListener('click', () => {
      state.activeFilter = elements.subjectFilterSelect.value;
      state.currentIndex = 0;
      applyFilter();
      renderCard(false);
      saveCurrentState();
      elements.modalSubject.classList.remove('open');
      showToast('과목이 변경되었습니다.');
      if (state.isPlaying) startStudyCycle();
    });

    // Files Modal
    elements.btnOpenFiles.addEventListener('click', () => {
      updateDatasetDropdown();
      elements.modalFiles.classList.add('open');
    });

    elements.btnCloseFiles.addEventListener('click', () => {
      elements.modalFiles.classList.remove('open');
    });

    elements.activeDatasetSelect.addEventListener('change', (e) => {
      state.activeDatasetId = e.target.value;
      state.currentIndex = 0;
      applyFilter();
      renderCard(false);
      saveCurrentState();
      showToast('문제집이 변경되었습니다.');
      elements.modalFiles.classList.remove('open');
    });

    // 1. PDF File Upload Listener
    elements.fileInputPdf.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await parsePdfFile(file);
      e.target.value = '';
    });

    // 2. CSV File Upload Listener
    elements.fileInputCsv.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        parseCsvFile(event.target.result, file.name);
        e.target.value = '';
      };
      reader.readAsText(file, 'utf-8');
    });

    // 3. TXT or JSON File Upload Listener
    elements.fileInputTxt.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        if (file.name.endsWith('.json')) {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const title = file.name.replace(/\.[^/.]+$/, '');
              addNewDataset(title, parsed);
              showToast(`JSON에서 ${parsed.length}개 문제를 추가했습니다!`);
            }
          } catch (err) {
            alert('JSON 파싱 오류: ' + err.message);
          }
        } else {
          // Plain Text
          const parsed = parsePlainText(text);
          if (parsed.length > 0) {
            const title = file.name.replace(/\.[^/.]+$/, '');
            addNewDataset(title, parsed);
            showToast(`텍스트 파일에서 ${parsed.length}개 문제를 추가했습니다!`);
          } else {
            alert('인식 가능한 문제가 없습니다.');
          }
        }
        e.target.value = '';
      };
      reader.readAsText(file, 'utf-8');
    });

    // 4. Paste Text Parser
    elements.btnParsePasteText.addEventListener('click', () => {
      const text = elements.pasteTextInput.value.trim();
      if (!text) {
        alert('문제를 붙여넣어 주세요.');
        return;
      }

      const parsedQuestions = parsePlainText(text);
      if (parsedQuestions.length === 0) {
        alert('인식 가능한 문제가 없습니다. "문제:", "답:", "해설:" 형식으로 입력해 주세요.');
        return;
      }

      const newTitle = `직접 입력 문제집 (${parsedQuestions.length}문제)`;
      addNewDataset(newTitle, parsedQuestions);
      elements.pasteTextInput.value = '';
      showToast(`새 문제집 (${parsedQuestions.length}문제) 생성 완료!`);
    });

    // 5. Download Sample CSV
    elements.btnDownloadCsvSample.addEventListener('click', () => {
      const csvContent = "\uFEFF문제,보기1,보기2,보기3,보기4,정답,해설\n" +
        "타원체의 편평률 공식은?,(a-b)/a,(a-b)/b,a/b,b/a,1,장반경과 단반경의 차를 장반경으로 나눕니다.\n" +
        "지리좌표에 해당하지 않는 것은?,측지위도,경도,시간,높이,3,시간은 공간좌표에 포함되지 않습니다.\n";
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '기출문제_양식_샘플.csv';
      a.click();
      URL.revokeObjectURL(url);
    });

    // 6. Download Sample JSON
    elements.btnDownloadSample.addEventListener('click', () => {
      const sample = [
        {
          id: 1,
          subject: "1과목: 측지학",
          question: "타원체의 편평률 공식은?",
          options: ["① (a-b)/a", "② (a-b)/b", "③ a/b", "④ b/a"],
          answer: 1,
          answerText: "① (a-b)/a",
          explanation: "장반경 a와 단반경 b의 차이를 장반경으로 나누어 편평률을 구합니다."
        }
      ];
      const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drive_study_sample.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Reset data
    elements.btnResetData.addEventListener('click', () => {
      if (confirm('모든 사용자 추가 문제집과 북마크를 초기화하시겠습니까?')) {
        localStorage.clear();
        location.reload();
      }
    });

    // Resume banner dismiss
    elements.btnDismissResume.addEventListener('click', () => {
      elements.resumeBanner.style.display = 'none';
    });

    // Explanation Direct Editing
    elements.btnEditExp.addEventListener('click', () => {
      const q = getCurrentQuestion();
      if (!q) return;
      elements.editExpQlabel.textContent = `문제 ${q.id}번 해설 편집`;
      elements.editExpTextarea.value = q.explanation || '';
      elements.modalEditExp.classList.add('open');
    });

    elements.btnCloseEditExp.addEventListener('click', () => {
      elements.modalEditExp.classList.remove('open');
    });

    elements.btnSaveEditExp.addEventListener('click', () => {
      const q = getCurrentQuestion();
      if (!q) return;
      const newExp = elements.editExpTextarea.value.trim();
      q.explanation = newExp || `${q.id}번 정답은 ${q.answer}번입니다.`;
      elements.explanationText.textContent = q.explanation;

      // Save into custom dataset in localStorage
      if (state.activeDatasetId !== 'DEFAULT') {
        const customOnly = { ...state.datasets };
        delete customOnly.DEFAULT;
        localStorage.setItem(STORAGE_KEYS.CUSTOM_DATASETS, JSON.stringify(customOnly));
      }
      saveCurrentState();
      elements.modalEditExp.classList.remove('open');
      showToast('해설이 저장되었습니다! 💾');
    });

    // Gemini AI Single Question Explanation Generator
    if (elements.btnGeminiAi) {
      elements.btnGeminiAi.addEventListener('click', async () => {
        const q = getCurrentQuestion();
        if (!q) return;
        await callGeminiForQuestion(q);
      });
    }

    // Gemini AI Banner Prompt Button
    if (elements.btnBannerGemini) {
      elements.btnBannerGemini.addEventListener('click', async () => {
        const q = getCurrentQuestion();
        if (!q) return;
        await callGeminiForQuestion(q);
      });
    }

    // Gemini AI Batch Generator
    if (elements.btnBatchGemini) {
      elements.btnBatchGemini.addEventListener('click', async () => {
        await callGeminiBatch();
      });
    }

    // Restore Default Dataset
    if (elements.btnRestoreDefault) {
      elements.btnRestoreDefault.addEventListener('click', () => {
        state.activeDatasetId = 'DEFAULT';
        state.currentIndex = 0;
        applyFilter();
        renderCard(false);
        saveCurrentState();
        updateDatasetDropdown();
        elements.modalFiles.classList.remove('open');
        showToast('📚 기본 문제집(100문제 상세해설 포함)으로 복원되었습니다!');
      });
    }

    // Gemini Setup Modal Handlers
    if (elements.btnCloseGeminiSetup) {
      elements.btnCloseGeminiSetup.addEventListener('click', () => {
        elements.modalGeminiSetup.classList.remove('open');
      });
    }

    if (elements.btnSaveGeminiKey) {
      elements.btnSaveGeminiKey.addEventListener('click', async () => {
        const val = elements.inputGeminiKeySetup.value.trim();
        if (!val) {
          alert('API 키를 입력해 주세요.');
          return;
        }
        state.settings.geminiKey = val;
        saveCurrentState();
        elements.modalGeminiSetup.classList.remove('open');
        showToast('Gemini API 키가 저장되었습니다! ✨');
        const q = getCurrentQuestion();
        if (q) {
          await callGeminiForQuestion(q);
        }
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (['input', 'textarea', 'select'].includes(e.target.tagName.toLowerCase())) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        replayCurrent();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        toggleBookmark();
      }
    });
  }

  // --- Gemini AI Modal & Utilities ---
  function openGeminiSetupModal() {
    if (elements.modalGeminiSetup) {
      if (elements.inputGeminiKeySetup) {
        elements.inputGeminiKeySetup.value = state.settings.geminiKey || '';
      }
      elements.modalGeminiSetup.classList.add('open');
    }
  }

  function isPlaceholderExplanation(exp) {
    if (!exp) return true;
    const s = exp.trim();
    if (s.length < 35) return true;
    if (/^\d+번\s*문제의\s*정답은/i.test(s)) return true;
    if (/^정답은\s*\d+번/i.test(s) && s.length < 55) return true;
    if (/출제\s*의도에\s*부합하는\s*정답입니다/i.test(s)) return true;
    if (/해설이\s*(?:등록|준비)되지\s*않았습니다/i.test(s)) return true;
    return false;
  }

  // Resilient multi-model Gemini REST API caller
  async function callGeminiApi(key, payload) {
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash'
    ];
    let lastErr = null;
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          return await res.json();
        }
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP ${res.status}`;
        
        // Check if model is retired, not found, or unsupported
        const isUnavailable = res.status === 404 || 
          /not\s*found|no\s*longer\s*available|deprecated|not\s*supported/i.test(errMsg);

        if (isUnavailable) {
          lastErr = new Error(errMsg);
          continue; // try next candidate model
        }
        throw new Error(errMsg);
      } catch (e) {
        lastErr = e;
        if (e.message && /not\s*found|no\s*longer\s*available|deprecated|not\s*supported|404/i.test(e.message)) {
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error('Gemini API 호출에 실패했습니다.');
  }

  // --- Gemini API Call Functions ---
  async function callGeminiForQuestion(q, silent = false) {
    let key = state.settings.geminiKey;
    if (!key) {
      openGeminiSetupModal();
      return false;
    }

    if (!silent) {
      showToast('✨ Gemini AI가 문제 해석 및 전문 해설을 생성 중입니다...');
      if (elements.btnGeminiAi) {
        elements.btnGeminiAi.textContent = '⏳ AI 분석 중...';
        elements.btnGeminiAi.disabled = true;
      }
    }

    try {
      const promptText = `당신은 국가기술자격증 필기시험 전문 1타 강사이자 운전용 오디오 학습 해설가입니다.
운전 중이나 이동 중에 귀로 들으면서 머리에 쏙쏙 박힐 수 있도록 다음 문제에 대한 명쾌하고 친절한 음성용 해설을 작성해 주세요.

[문제 정보]
- 과목: ${q.subject || ''}
- 문제: ${q.question}
- 보기:
${(q.options || []).join('\n')}
- 정답: ${q.answerText || q.answer + '번'}

[작성 지침]
1. 첫 문장: 이 문제의 출제 의도와 핵심 개념을 한 줄로 명쾌하게 요약하세요.
2. 두 번째 문장: 왜 정답이 되는지 구체적인 원리, 공식(계산법), 또는 암기 키워드를 설명하세요.
3. 세 번째 문장: 다른 오답 보기가 왜 틀렸는지(함정 포인트) 또는 관련 시험 빈출 팁을 덧붙여 주세요.
4. 듣기 편안한 부드러운 구어체(예: "~입니다", "~를 꼭 기억하세요")로 3~4문장으로 명확히 작성하세요. 불필요한 마크다운 별표(***)나 서식 기호는 절대 넣지 마세요.`;

      const data = await callGeminiApi(key, {
        contents: [{ parts: [{ text: promptText }] }]
      });

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleanExplanation = rawText
          .replace(/\*\*/g, '')
          .replace(/###/g, '')
          .replace(/```/g, '')
          .trim();

        q.explanation = cleanExplanation;
        q.isAiGenerated = true;

        const currentQ = getCurrentQuestion();
        if (currentQ && currentQ.id === q.id) {
          elements.explanationText.textContent = q.explanation;
          if (elements.aiExpBadge) elements.aiExpBadge.style.display = 'inline-block';
          if (elements.aiExpPromptBanner) elements.aiExpPromptBanner.style.display = 'none';
        }

        if (state.activeDatasetId !== 'DEFAULT') {
          const customOnly = { ...state.datasets };
          delete customOnly.DEFAULT;
          localStorage.setItem(STORAGE_KEYS.CUSTOM_DATASETS, JSON.stringify(customOnly));
        }
        saveCurrentState();

        if (!silent) {
          playSoftChime();
          showToast('🎉 Gemini AI 전문 해설 완성!');
        }
        return true;
      } else {
        throw new Error('AI 응답 내용이 비어있습니다.');
      }
    } catch (err) {
      if (!silent) {
        alert('Gemini AI 해설 생성 오류: ' + err.message + '\n\nAPI 키가 유효한지 확인해 주세요.');
      }
      return false;
    } finally {
      if (elements.btnGeminiAi) {
        elements.btnGeminiAi.textContent = '✨ AI 해설';
        elements.btnGeminiAi.disabled = false;
      }
    }
  }

  async function callGeminiBatch() {
    let key = state.settings.geminiKey;
    if (!key) {
      openGeminiSetupModal();
      return;
    }

    const currentQuestions = state.datasets[state.activeDatasetId]?.questions || [];
    if (currentQuestions.length === 0) {
      alert('해설을 생성할 문제가 없습니다.');
      return;
    }

    if (!confirm(`현재 문제집의 ${currentQuestions.length}개 문제 전체에 대해 Gemini AI로 전문 해설을 자동 생성하시겠습니까?\n(약 15~30초 소요됩니다.)`)) {
      return;
    }

    showToast('🤖 AI 전체 해설 생성을 시작합니다...');
    if (elements.btnBatchGemini) elements.btnBatchGemini.disabled = true;

    try {
      const batchSize = 5;
      for (let i = 0; i < currentQuestions.length; i += batchSize) {
        const chunk = currentQuestions.slice(i, i + batchSize);
        if (elements.btnBatchGemini) {
          elements.btnBatchGemini.textContent = `⏳ AI 해설 생성 중 (${i + 1}/${currentQuestions.length})...`;
        }
        
        const promptText = `당신은 국가기술자격증 필기시험 전문 강사입니다. 다음 ${chunk.length}개 문제에 대해 운전 중 들을 수 있는 친절하고 명쾌한 음성용 해설을 JSON 배열 형식으로 작성해 주세요.

문제 목록:
${JSON.stringify(chunk.map(q => ({
  id: q.id,
  subject: q.subject,
  question: q.question,
  options: q.options,
  answer: q.answerText || q.answer + '번'
})), null, 2)}

[응답 요구사항]
오직 유효한 JSON 배열만 응답하세요. 각 객체는 {"id": 문제번호, "explanation": "해설내용"} 형태여야 합니다.
해설은 핵심 개념 ➔ 정답 이유 ➔ 오답 함정/암기 팁 순으로 부드러운 구어체 3~4문장으로 작성하세요. 마크다운 별표 기호는 빼주세요.`;

        const data = await callGeminiApi(key, {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });

        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          try {
            const parsedArr = JSON.parse(rawJson);
            if (Array.isArray(parsedArr)) {
              parsedArr.forEach(item => {
                const foundQ = currentQuestions.find(q => q.id === item.id);
                if (foundQ && item.explanation) {
                  foundQ.explanation = item.explanation.replace(/\*\*/g, '').trim();
                  foundQ.isAiGenerated = true;
                }
              });
            }
          } catch (e) {
            console.warn('JSON parse warning in batch:', e);
          }
        }

        if (state.activeDatasetId !== 'DEFAULT') {
          const customOnly = { ...state.datasets };
          delete customOnly.DEFAULT;
          localStorage.setItem(STORAGE_KEYS.CUSTOM_DATASETS, JSON.stringify(customOnly));
        }
        saveCurrentState();
      }

      renderCard(true);
      showToast('🎉 전체 문제의 Gemini AI 전문 해설이 완성되었습니다!');
    } catch (err) {
      alert('AI 해설 생성 오류: ' + err.message);
    } finally {
      if (elements.btnBatchGemini) {
        elements.btnBatchGemini.textContent = '🤖 현재 문제집 전체 Gemini AI 해설 자동 완성';
        elements.btnBatchGemini.disabled = false;
      }
    }
  }

  // --- Initialize App ---
  function init() {
    if (window.DEFAULT_QUESTIONS && Array.isArray(window.DEFAULT_QUESTIONS)) {
      state.datasets.DEFAULT.questions = window.DEFAULT_QUESTIONS;
    }

    loadPersistedState();
    applyFilter();

    const savedLastIndexId = localStorage.getItem(STORAGE_KEYS.LAST_INDEX);
    if (savedLastIndexId) {
      const targetId = parseInt(savedLastIndexId, 10);
      const foundIdx = state.filteredQuestions.findIndex(q => q.id === targetId);
      if (foundIdx !== -1) {
        state.currentIndex = foundIdx;
        elements.resumeBanner.style.display = 'flex';
        elements.resumeMsg.textContent = `📌 이전 학습 ${targetId}번 문제에서 이어서 복원되었습니다.`;
      }
    }

    setupEventListeners();
    renderCard(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

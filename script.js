// script.js - exam mode with timer, question grid, instant feedback, scoring
// Assumes questions.json present in same folder and each object: id, question, options, correct, explanation

let allQuestions = [];
let examQuestions = []; // subset for the current exam
let currentIndex = 0;
let userAnswers = {};     // map question.id -> selected letter
let flagged = {};         // map question.id -> true/false
let examStarted = false;
let examEnded = false;
let timerInterval = null;
let timeLeftSec = 0;

const el = id => document.getElementById(id);

// Load questions.json
async function loadAllQuestions(){
  try{
    const res = await fetch('questions.json');
    if(!res.ok) throw new Error('Không tải được questions.json');
    allQuestions = await res.json();
    // set default max in setup
    el('num-questions').max = allQuestions.length;
    if(parseInt(el('num-questions').value) > allQuestions.length) el('num-questions').value = Math.min(10, allQuestions.length);
    buildGridPlaceholder(allQuestions.length);
  }catch(err){
    console.error(err);
    el('question').textContent = 'Lỗi khi tải câu hỏi: ' + err.message;
  }
}

// sanitize HTML using DOMPurify
function sanitizeHTML(html){
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b','i','u','br','p','table','thead','tbody','tr','th','td','caption','img','ul','ol','li','sup','sub','span','div','strong','em'],
    ALLOWED_ATTR: ['src','alt','width','height','class','style','scope','loading']
  });
}

// UI: build initial grid placeholders
function buildGridPlaceholder(n){
  const grid = el('question-grid');
  grid.innerHTML = '';
  for(let i=0;i<n;i++){
    const cell = document.createElement('button');
    cell.className = 'qcell unanswered';
    cell.type = 'button';
    cell.dataset.index = i;
    cell.textContent = i+1;
    cell.addEventListener('click', ()=> {
      if(!examQuestions.length) return;
      // navigate
      goToQuestion(i);
    });
    grid.appendChild(cell);
  }
}

// Start exam: prepare examQuestions array and UI
function startExam(){
  const n = Math.max(1, Math.min(parseInt(el('num-questions').value || 1), allQuestions.length));
  const minutes = Math.max(1, parseInt(el('exam-minutes').value || 30));
  const randomize = el('randomize').checked;

  // choose questions
  if(randomize){
    // shuffle and take n
    const shuffled = [...allQuestions].sort(()=>Math.random()-0.5);
    examQuestions = shuffled.slice(0,n);
  } else {
    examQuestions = allQuestions.slice(0,n);
  }

  // reset state
  userAnswers = {};
  flagged = {};
  currentIndex = 0;
  examStarted = true;
  examEnded = false;
  timeLeftSec = minutes * 60;

  // update UI
  el('exam-setup').hidden = true;
  el('exam-controls').hidden = false;
  el('start-exam-btn').disabled = true;
  el('prev-btn').disabled = false;
  el('next-btn').disabled = false;
  el('result-box').hidden = true;
  renderQuestionGrid(); // grid built for examQuestions length
  showQuestion(0);

  // start timer
  startTimer();
}

// timer functions
function startTimer(){
  updateTimerDisplay();
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    timeLeftSec--;
    updateTimerDisplay();
    if(timeLeftSec <= 0){
      clearInterval(timerInterval);
      endExam('timeup');
    }
  },1000);
}
function stopTimer(){
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}
function updateTimerDisplay(){
  const mm = Math.floor(timeLeftSec / 60);
  const ss = timeLeftSec % 60;
  el('timer-display').textContent = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// render grid for examQuestions
function renderQuestionGrid(){
  const grid = el('question-grid');
  grid.innerHTML = '';
  for(let i=0;i<examQuestions.length;i++){
    const q = examQuestions[i];
    const cell = document.createElement('button');
    cell.className = 'qcell unanswered';
    cell.type = 'button';
    cell.dataset.index = i;
    cell.title = `Câu ${i+1}`;
    cell.textContent = i+1;
    cell.addEventListener('click', ()=> goToQuestion(i));
    grid.appendChild(cell);
  }
  updateGridStatus();
}

// update grid statuses colors
function updateGridStatus(){
  const cells = Array.from(el('question-grid').children);
  cells.forEach((cell, idx)=>{
    const q = examQuestions[idx];
    const id = q && q.id;
    cell.className = 'qcell';
    if(flagged[id]) {
      cell.classList.add('flagged');
    } else if(userAnswers[id] === undefined){
      cell.classList.add('unanswered');
    } else {
      // check correctness
      const selected = userAnswers[id];
      const correct = (q.correct || '').toString();
      if(selected === correct) cell.classList.add('answered');
      else cell.classList.add('wrong');
    }
  });
}

// show particular question index (in examQuestions)
function showQuestion(idx){
  if(!examStarted || !examQuestions.length) return;
  currentIndex = Math.max(0, Math.min(idx, examQuestions.length - 1));
  const q = examQuestions[currentIndex];
  el('q-index').textContent = `Câu ${currentIndex+1} / ${examQuestions.length}`;
  el('q-title').textContent = '';
  el('question').innerHTML = sanitizeHTML(q.question || '');

  // build answers
  const answersDiv = el('answers');
  answersDiv.innerHTML = '';
  const keys = q.options ? Object.keys(q.options).sort() : [];
  keys.forEach(key=>{
    const text = q.options[key] || '';
    if(!text || !text.trim()) return;
    const opt = document.createElement('div');
    opt.className = 'answer-option';
    opt.dataset.key = key;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'answer';
    radio.value = key;
    radio.id = `q${q.id}-opt-${key}`;

    // mark previously selected
    if(userAnswers[q.id] === key) radio.checked = true;

    const label = document.createElement('label');
    label.htmlFor = radio.id;
    label.innerHTML = sanitizeHTML(`<strong>${key}.</strong> ${text}`);

    // click handler: allow change while exam not ended
    opt.addEventListener('click', (ev)=>{
      if(examEnded) return;
      userAnswers[q.id] = key;
      // show immediate feedback and explanation
      revealAnswerVisual(q, key);
      updateGridStatus();
    });

    // also radio change
    radio.addEventListener('change', ()=>{
      if(examEnded) return;
      userAnswers[q.id] = radio.value;
      revealAnswerVisual(q, radio.value);
      updateGridStatus();
    });

    opt.appendChild(radio);
    opt.appendChild(label);
    answersDiv.appendChild(opt);
  });

  // show explanation if already answered
  if(userAnswers[q.id]){
    revealAnswerVisual(q, userAnswers[q.id]);
  } else {
    hideExplanation();
    // remove styles
    const opts = answersDiv.querySelectorAll('.answer-option');
    opts.forEach(div => div.classList.remove('correct','incorrect'));
  }

  updateGridStatus();
  // scroll grid to visible cell (for mobile)
  scrollGridTo(currentIndex);

  // MathJax render
  if(window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise();
}

// reveal visual feedback for a question when selectedKey provided
function revealAnswerVisual(q, selectedKey){
  const answersDiv = el('answers');
  const optionDivs = Array.from(answersDiv.querySelectorAll('.answer-option'));
  const correctKey = (q.correct || '').toString();

  optionDivs.forEach(div=>{
    const key = div.dataset.key;
    div.classList.remove('correct','incorrect');
    if(key === correctKey){
      div.classList.add('correct');
    }
    if(key === selectedKey && key !== correctKey){
      div.classList.add('incorrect');
    }
  });

  // show explanation
  const explBox = el('explanation');
  const explanationHtml = q.explanation ? q.explanation : '<em>Không có lời giải chi tiết.</em>';
  explBox.innerHTML = sanitizeHTML(explanationHtml);
  explBox.style.display = 'block';
  // MathJax for explanation
  if(window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise();
}

// hide explanation
function hideExplanation(){
  const explBox = el('explanation');
  explBox.style.display = 'none';
  explBox.innerHTML = '';
}

// navigate functions
function goToQuestion(idx){
  if(!examStarted) return;
  showQuestion(idx);
}

// scroll grid to make active cell visible
function scrollGridTo(idx){
  const grid = el('question-grid');
  const cell = grid.querySelector(`button[data-index="${idx}"]`);
  if(!cell) return;
  // use scrollIntoView with nearest behavior
  cell.scrollIntoView({behavior:'smooth', block:'nearest', inline:'nearest'});
}

// toggle flag for current question
function toggleFlag(){
  if(!examStarted || examEnded) return;
  const q = examQuestions[currentIndex];
  flagged[q.id] = !flagged[q.id];
  updateGridStatus();
}

// reset answer for current question
function resetCurrentAnswer(){
  if(!examStarted || examEnded) return;
  const q = examQuestions[currentIndex];
  delete userAnswers[q.id];
  hideExplanation();
  // re-render question to remove styling
  showQuestion(currentIndex);
  updateGridStatus();
}

// endExam: reason 'manual' or 'timeup'
function endExam(reason='manual'){
  if(!examStarted || examEnded) return;
  examEnded = true;
  stopTimer();

  // disable inputs visually by re-rendering and disabling click handlers via guard
  // compute score
  let correctCount = 0;
  for(const q of examQuestions){
    const id = q.id;
    const selected = userAnswers[id];
    const correct = (q.correct || '').toString();
    if(selected && selected === correct) correctCount++;
  }
  const total = examQuestions.length;
  const pct = total ? Math.round((correctCount / total) * 10000) / 100 : 0; // 2 decimals
  // show results
  el('result-box').hidden = false;
  el('score-summary').textContent = `Bạn đúng ${correctCount}/${total} câu (${pct}%).`;
  el('pass-msg').textContent = pct > 50 ? 'CHÚC MỪNG — Bạn đã đạt (>=50%)' : 'Bạn chưa đạt (dưới 50%).';

  // update grid (final color states)
  updateGridStatus();

  // highlight all correct answers as green, but keep incorrect red for selected wrong ones
  // For each question, update the UI if user navigates there - also disable further changing due to examEnded guard

  // optionally scroll to top
  window.scrollTo({top:0, behavior:'smooth'});
}

// attach event listeners
function attachHandlers(){
  el('start-exam-btn').addEventListener('click', startExam);
  el('end-exam-btn').addEventListener('click', ()=> endExam('manual'));
  el('flag-btn').addEventListener('click', toggleFlag);
  el('reset-answer-btn').addEventListener('click', resetCurrentAnswer);
  el('prev-btn').addEventListener('click', ()=>{
    if(!examStarted) return;
    if(currentIndex > 0) showQuestion(currentIndex - 1);
  });
  el('next-btn').addEventListener('click', ()=>{
    if(!examStarted) return;
    if(currentIndex < examQuestions.length - 1) showQuestion(currentIndex + 1);
  });
  el('review-btn')?.addEventListener('click', ()=>{
    // when reviewing after exam end, jump to first question
    if(examQuestions.length) showQuestion(0);
    el('result-box').hidden = true;
  });
}
//Làm lại
function restartQuiz() {
    console.log('Restarting quiz...');
    currentQuestionIndex = 0;
    score = 0;
    selectedOption = null;
    selectedQuestions = [];
    userAnswers = [];
    clearInterval(timerId);
    const scoreValueElement = document.getElementById('score-value');
    if (scoreValueElement) {
        scoreValueElement.textContent = `0/0`;
        console.log('Score reset in restartQuiz to:', scoreValueElement.textContent);
    }
    const quizHeader = document.querySelector('.quiz-header');
    if (quizHeader) quizHeader.style.display = 'none';
    document.getElementById('quiz').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    const pastScores = document.getElementById('past-scores');
    if (pastScores) pastScores.style.display = 'block';
    const clearScoresBtn = document.getElementById('clear-scores-btn');
    if (clearScoresBtn) clearScoresBtn.style.display = 'block';
    updateNumQuestionsOptions();
    displayPastScores();
}
// initialize
window.addEventListener('load', async ()=>{
  attachHandlers();
  await loadAllQuestions();
});

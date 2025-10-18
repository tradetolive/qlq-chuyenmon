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
    displayScoreHistory();
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
  el('score-history').hidden = true;
  el('exam-controls').hidden = false;
  el('start-exam-btn').disabled = true;
  el('prev-btn').disabled = false;
  el('next-btn').disabled = false;
  el('result-box').hidden = true;
  renderQuestionGrid();
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
      const selected = userAnswers[id];
      const correct = (q.correct || '').toString();
      if(selected === correct) cell.classList.add('answered');
      else cell.classList.add('wrong');
    }
  });
}

// show particular question index (in examQuestions)
function showQuestion(idx){
  if(!examQuestions.length) return;
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
    if(userAnswers[q.id] === key) radio.checked = true;
    radio.disabled = examEnded; // Disable radio buttons if exam ended

    const label = document.createElement('label');
    label.htmlFor = radio.id;
    label.innerHTML = sanitizeHTML(`<strong>${key}.</strong> ${text}`);

    opt.addEventListener('click', (ev)=>{
      if(examEnded) return;
      userAnswers[q.id] = key;
      revealAnswerVisual(q, key);
      updateGridStatus();
    });

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
  if(userAnswers[q.id] || examEnded){
    revealAnswerVisual(q, userAnswers[q.id]);
  } else {
    hideExplanation();
    const opts = answersDiv.querySelectorAll('.answer-option');
    opts.forEach(div => div.classList.remove('correct','incorrect'));
  }

  updateGridStatus();
  scrollGridTo(currentIndex);

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
  if(!examStarted && !examEnded) return;
  showQuestion(idx);
}

// scroll grid to make active cell visible
function scrollGridTo(idx){
  const grid = el('question-grid');
  const cell = grid.querySelector(`button[data-index="${idx}"]`);
  if(!cell) return;
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
  showQuestion(currentIndex);
  updateGridStatus();
}

// Save score to localStorage
function saveScore(correctCount, total, pct){
  const scores = JSON.parse(localStorage.getItem('quizScores') || '[]');
  const timestamp = new Date().toLocaleString('vi-VN');
  scores.push({ correctCount, total, pct, timestamp });
  localStorage.setItem('quizScores', JSON.stringify(scores));
}

// Display score history
function displayScoreHistory(){
  const scoreList = el('score-list');
  const scores = JSON.parse(localStorage.getItem('quizScores') || '[]');
  scoreList.innerHTML = '';
  if(scores.length === 0){
    scoreList.innerHTML = '<li>Chưa có lịch sử điểm số.</li>';
    return;
  }
  scores.forEach(score => {
    const li = document.createElement('li');
    li.textContent = `${score.timestamp}: ${score.correctCount}/${score.total} (${score.pct.toFixed(2)}%)`;
    scoreList.appendChild(li);
  });
}

// Clear score history
function clearScoreHistory(){
  localStorage.removeItem('quizScores');
  displayScoreHistory();
}

// endExam: reason 'manual' or 'timeup'
function endExam(reason='manual'){
  if(!examStarted || examEnded) return;
  examEnded = true;
  stopTimer();

  // compute score
  let correctCount = 0;
  for(const q of examQuestions){
    const id = q.id;
    const selected = userAnswers[id];
    const correct = (q.correct || '').toString();
    if(selected && selected === correct) correctCount++;
  }
  const total = examQuestions.length;
  const pct = total ? Math.round((correctCount / total) * 10000) / 100 : 0;

  // save score
  saveScore(correctCount, total, pct);

  // show results
  el('result-box').hidden = false;
  el('exam-controls').hidden = true;
  el('question-wrapper').hidden = true;
  el('nav-buttons').hidden = true;
  el('score-summary').textContent = `Bạn đúng ${correctCount}/${total} câu (${pct}%).`;
  el('pass-msg').textContent = pct > 50 ? 'CHÚC MỪNG — Bạn đã đạt (>=50%)' : 'Bạn chưa đạt (dưới 50%).';

  // show detailed results
  const resultDetails = el('result-details');
  resultDetails.innerHTML = '';
  examQuestions.forEach((q, idx) => {
    const selected = userAnswers[q.id];
    const correct = q.correct || '';
    const isCorrect = selected && selected === correct;
    const div = document.createElement('div');
    div.className = `question-review ${isCorrect ? 'correct' : selected ? 'incorrect' : 'unanswered'}`;
    div.innerHTML = sanitizeHTML(`
      <p><strong>Câu ${idx + 1}:</strong> ${q.question}</p>
      <p><strong>Đáp án của bạn:</strong> ${selected ? `${selected}. ${q.options[selected] || 'Không có'}` : 'Chưa trả lời'}</p>
      <p><strong>Đáp án đúng:</strong> ${correct}. ${q.options[correct] || 'Không có'}</p>
      <p><strong>Lời giải:</strong> ${q.explanation || '<em>Không có lời giải chi tiết.</em>'}</p>
    `);
    resultDetails.appendChild(div);
  });

  updateGridStatus();
  window.scrollTo({top:0, behavior:'smooth'});
  if(window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise();
}

// Reset quiz to initial state
function restartQuiz(){
  examQuestions = [];
  userAnswers = {};
  flagged = {};
  currentIndex = 0;
  examStarted = false;
  examEnded = false;
  timeLeftSec = 0;
  stopTimer();
  el('exam-setup').hidden = false;
  el('score-history').hidden = false;
  el('exam-controls').hidden = true;
  el('question-wrapper').hidden = false;
  el('nav-buttons').hidden = false;
  el('start-exam-btn').disabled = false;
  el('prev-btn').disabled = true;
  el('next-btn').disabled = true;
  el('result-box').hidden = true;
  el('question').innerHTML = '';
  el('answers').innerHTML = '';
  hideExplanation();
  buildGridPlaceholder(allQuestions.length);
  displayScoreHistory();
}

// attach event listeners
function attachHandlers(){
  el('start-exam-btn').addEventListener('click', startExam);
  el('end-exam-btn').addEventListener('click', ()=> endExam('manual'));
  el('flag-btn').addEventListener('click', toggleFlag);
  el('reset-answer-btn').addEventListener('click', resetCurrentAnswer);
  el('prev-btn').addEventListener('click', ()=>{
    if(!examStarted && !examEnded) return;
    if(currentIndex > 0) showQuestion(currentIndex - 1);
  });
  el('next-btn').addEventListener('click', ()=>{
    if(!examStarted && !examEnded) return;
    if(currentIndex < examQuestions.length - 1) showQuestion(currentIndex + 1);
  });
  el('restart-btn').addEventListener('click', restartQuiz);
  el('review-btn').addEventListener('click', ()=>{
    el('result-box').hidden = true;
    el('exam-controls').hidden = true;
    el('question-wrapper').hidden = false;
    el('nav-buttons').hidden = false;
    showQuestion(0);
  });
  el('clear-scores-btn').addEventListener('click', clearScoreHistory);
}

// initialize
window.addEventListener('load', async ()=>{
  attachHandlers();
  await loadAllQuestions();
});

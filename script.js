// script.js - render questions, cung cấp feedback ngay khi chọn đáp án
// Yêu cầu: questions.json nằm cùng thư mục và mỗi object có fields: id, question (HTML), options (object A..E), correct (letter), explanation (HTML optional)

let questions = [];
let currentIndex = 0;
const userAnswers = {}; // key: question.id -> selected letter
const answered = {}; // key: question.id -> true/false

async function loadQuestions(){
  try{
    const res = await fetch('questions.json');
    if(!res.ok) throw new Error('Không thể tải questions.json');
    questions = await res.json();
    if(!Array.isArray(questions) || !questions.length){
      document.getElementById('status').textContent = 'Không tìm thấy câu hỏi.';
      return;
    }
    showQuestion(currentIndex);
  }catch(err){
    console.error(err);
    document.getElementById('status').textContent = 'Lỗi khi tải câu hỏi: ' + err.message;
  }
}

function sanitizeHTML(html){
  // Cho phép 1 số tag để hiển thị câu hỏi: bảng, img, b, i, br, p, ul, ol, li, sup, sub, span, div, table...
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b','i','u','br','p','table','thead','tbody','tr','th','td','caption','img','ul','ol','li','sup','sub','span','div','strong','em'],
    ALLOWED_ATTR: ['src','alt','width','height','class','style','scope','loading']
  });
}

function showQuestion(index){
  const q = questions[index];
  if(!q) return;

  document.getElementById('q-index').textContent = `Câu ${index+1}/${questions.length}`;
  document.getElementById('q-title').textContent = '';
  document.getElementById('question').innerHTML = sanitizeHTML(q.question || '');

  const answersDiv = document.getElementById('answers');
  answersDiv.innerHTML = '';

  // build options in order A..E (or keys present)
  const keys = q.options ? Object.keys(q.options) : [];
  // ensure stable order A..E
  keys.sort();

  keys.forEach(key=>{
    const text = q.options[key] ? q.options[key] : '';
    if(!text || text.trim()==='') return; // skip blank options

    const optionDiv = document.createElement('div');
    optionDiv.className = 'answer-option';
    optionDiv.dataset.key = key;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'answer';
    radio.value = key;
    radio.id = `q${q.id}-opt-${key}`;

    // label (allow HTML in option text)
    const label = document.createElement('label');
    label.htmlFor = radio.id;
    label.innerHTML = sanitizeHTML(`<strong>${key}.</strong> ${text}`);

    optionDiv.appendChild(radio);
    optionDiv.appendChild(label);

    // click handler on whole div (so click label or area works)
    optionDiv.addEventListener('click', (ev)=>{
      ev.preventDefault();
      // if already answered, do nothing (prevents change). If you want to allow change, remove this guard.
      if(answered[q.id]) return;
      const selected = key;
      // mark radio checked
      radio.checked = true;
      handleAnswer(q, selected, optionDiv);
    });

    answersDiv.appendChild(optionDiv);
  });

  // If previously answered, restore visual state
  if(answered[q.id]){
    const prev = userAnswers[q.id];
    revealAnswerVisual(q, prev);
  } else {
    // hide explanation area
    const expl = document.getElementById('explanation');
    expl.style.display = 'none';
    expl.innerHTML = '';
  }

  // MathJax render (if any)
  if(window.MathJax && MathJax.typesetPromise){
    MathJax.typesetPromise();
  }

  // update nav buttons
  document.getElementById('prev-btn').disabled = index === 0;
  document.getElementById('next-btn').disabled = index === (questions.length - 1);
}

function handleAnswer(q, selectedKey, clickedDiv){
  userAnswers[q.id] = selectedKey;
  answered[q.id] = true;

  // reveal visuals and explanation
  revealAnswerVisual(q, selectedKey);

  // optionally you can store timestamp, send to server, etc.
}

function revealAnswerVisual(q, selectedKey){
  const answersDiv = document.getElementById('answers');
  const optionDivs = Array.from(answersDiv.querySelectorAll('.answer-option'));
  const correctKey = (q.correct || '').toString();

  optionDivs.forEach(div=>{
    const key = div.dataset.key;
    const radio = div.querySelector('input[type="radio"]');
    // disable radios to prevent changes
    if(radio) radio.disabled = true;

    // remove existing classes
    div.classList.remove('correct','incorrect');

    if(key === correctKey){
      // always mark correct with green
      div.classList.add('correct');
    }
    // if selected but incorrect, mark red
    if(key === selectedKey && key !== correctKey){
      div.classList.add('incorrect');
    }
  });

  // show explanation (sanitized)
  const explBox = document.getElementById('explanation');
  const explanationHtml = q.explanation ? q.explanation : '<em>Không có lời giải chi tiết.</em>';
  explBox.innerHTML = sanitizeHTML(explanationHtml);
  explBox.style.display = 'block';

  // render math inside explanation if any
  if(window.MathJax && MathJax.typesetPromise){
    MathJax.typesetPromise();
  }
}

document.getElementById('prev-btn').addEventListener('click', ()=>{
  if(currentIndex > 0){
    currentIndex--;
    showQuestion(currentIndex);
  }
});
document.getElementById('next-btn').addEventListener('click', ()=>{
  if(currentIndex < questions.length - 1){
    currentIndex++;
    showQuestion(currentIndex);
  }
});
document.getElementById('reset-btn').addEventListener('click', ()=>{
  // reset current question's answer (allow người dùng trả lời lại)
  const q = questions[currentIndex];
  if(!q) return;
  delete userAnswers[q.id];
  answered[q.id] = false;

  // re-enable inputs and remove classes
  const answersDiv = document.getElementById('answers');
  const optionDivs = Array.from(answersDiv.querySelectorAll('.answer-option'));
  optionDivs.forEach(div=>{
    const radio = div.querySelector('input[type="radio"]');
    if(radio){
      radio.checked = false;
      radio.disabled = false;
    }
    div.classList.remove('correct','incorrect');
  });
  const explBox = document.getElementById('explanation');
  explBox.style.display = 'none';
  explBox.innerHTML = '';

  // re-render math if needed
  if(window.MathJax && MathJax.typesetPromise){
    MathJax.typesetPromise();
  }
});

// load questions on page load
window.addEventListener('load', loadQuestions);

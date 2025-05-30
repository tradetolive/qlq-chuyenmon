let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;
let selectedQuestions = [];
let timeLeft = 600;
let timerId;
let userAnswers = [];

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

document.addEventListener('DOMContentLoaded', () => {
    fetch('questions.json')
        .then(response => response.json())
        .then(data => {
            questions = data;
            updateNumQuestionsOptions();
            displayPastScores();
            document.getElementById('start-btn').addEventListener('click', startQuiz);
            document.getElementById('next-btn').addEventListener('click', nextQuestion);
            document.getElementById('restart-btn').addEventListener('click', restartQuiz);
        })
        .catch(error => console.error('Lỗi tải câu hỏi:', error));
});

function updateNumQuestionsOptions() {
    const select = document.getElementById('num-questions');
    select.innerHTML = '';
    for (let i = 1; i <= questions.length; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        select.appendChild(option);
    }
}

function startQuiz() {
    const numQuestions = parseInt(document.getElementById('num-questions').value);
    if (questions.length === 0) {
        alert('Không có câu hỏi nào để bắt đầu!');
        document.getElementById('start-screen').style.display = 'block';
        document.getElementById('quiz').style.display = 'none';
        return;
    }
    selectedQuestions = shuffleArray([...questions]).slice(0, Math.min(numQuestions, questions.length));
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    document.getElementById('score-value').textContent = score;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('quiz').style.display = 'block';
    loadQuestion();
}

function loadQuestion() {
    if (currentQuestionIndex >= selectedQuestions.length) {
        showResult();
        return;
    }
    const questionData = selectedQuestions[currentQuestionIndex];
    document.getElementById('question').innerText = `Câu ${currentQuestionIndex + 1}/${selectedQuestions.length}: ${questionData.question}`;
    document.getElementById('progress').style.width = `${((currentQuestionIndex + 1) / selectedQuestions.length * 100)}%`;
    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = '';
    document.getElementById('feedback').innerText = '';
    document.getElementById('next-btn').disabled = true;
    selectedOption = null;
    timeLeft = 600;
    document.getElementById('time-left').textContent = timeLeft;
    startTimer();
    const optionKeys = shuffleArray(Object.keys(questionData.options).filter(key => questionData.options[key] !== ''));
    optionKeys.forEach(key => {
        const button = document.createElement('button');
        button.className = 'option';
        button.innerText = `${key}. ${questionData.options[key]}`;
        button.onclick = () => selectOption(button, key);
        optionsDiv.appendChild(button);
    });
}

function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
        timeLeft--;
        document.getElementById('time-left').textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerId);
            selectOption(null, null);
        }
    }, 1000);
}

function selectOption(button, option) {
    if (selectedOption) return;
    selectedOption = option;
    clearInterval(timerId);
    const correct = selectedQuestions[currentQuestionIndex].correct;
    const feedback = document.getElementById('feedback');
    document.querySelectorAll('.option').forEach(btn => {
        btn.disabled = true;
        const btnKey = btn.innerText.split('.')[0];
        if (btnKey === correct) {
            btn.classList.add('correct');
        } else if (btnKey === option && option !== correct) {
            btn.classList.add('incorrect');
        }
    });
    if (option === null) {
        feedback.innerText = `Hết thời gian! Đáp án đúng: ${correct}. ${selectedQuestions[currentQuestionIndex].options[correct]}`;
        feedback.style.color = 'red';
        userAnswers.push({ id: selectedQuestions[currentQuestionIndex].id, selected: null, correct: false });
    } else if (option === correct) {
        feedback.innerText = 'Đúng!';
        feedback.style.color = 'green';
        score++;
        document.getElementById('score-value').textContent = score;
        userAnswers.push({ id: selectedQuestions[currentQuestionIndex].id, selected: option, correct: true });
    } else {
        feedback.innerText = `Sai! Đáp án đúng: ${correct}. ${selectedQuestions[currentQuestionIndex].options[correct]}`;
        feedback.style.color = 'red';
        userAnswers.push({ id: selectedQuestions[currentQuestionIndex].id, selected: option, correct: false });
    }
    document.getElementById('next-btn').disabled = false;
}

function nextQuestion() {
    currentQuestionIndex++;
    loadQuestion();
}

function saveScore() {
    const pastScores = JSON.parse(localStorage.getItem('quizScores') || '[]');
    pastScores.push({
        score: `${score}/${selectedQuestions.length}`,
        percentage: (score / selectedQuestions.length * 100).toFixed(2),
        date: new Date().toLocaleString('vi-VN')
    });
    localStorage.setItem('quizScores', JSON.stringify(pastScores));
}

function displayPastScores() {
    const pastScores = JSON.parse(localStorage.getItem('quizScores') || '[]');
    const pastScoresDiv = document.getElementById('past-scores') || document.createElement('div');
    pastScoresDiv.id = 'past-scores';
    pastScoresDiv.innerHTML = '<h3>Lịch sử điểm:</h3>';
    if (pastScores.length === 0) {
        pastScoresDiv.innerHTML += '<p>Chưa có kết quả nào.</p>';
    } else {
        pastScores.forEach(score => {
            const p = document.createElement('p');
            p.innerText = `Ngày ${score.date}: ${score.score} (${score.percentage}%)`;
            pastScoresDiv.appendChild(p);
        });
    }
    document.getElementById('start-screen').appendChild(pastScoresDiv);
}

function showResult() {
    clearInterval(timerId);
    saveScore();
    document.getElementById('quiz').style.display = 'none';
    const resultDiv = document.getElementById('result');
    resultDiv.style.display = 'block';
    document.getElementById('score').innerText = `Bạn đúng ${score}/${selectedQuestions.length} câu (${(score/selectedQuestions.length*100).toFixed(2)}%)`;
    const detailedResults = document.getElementById('detailed-results');
    detailedResults.innerHTML = '<h3>Chi tiết câu trả lời:</h3>';
    userAnswers.forEach((answer, index) => {
        const question = selectedQuestions[index];
        const resultText = answer.correct
            ? `Câu ${question.id}: Đúng (Bạn chọn ${answer.selected})`
            : `Câu ${question.id}: Sai (Bạn chọn ${answer.selected || 'Không chọn'}, Đáp án đúng: ${question.correct})`;
        const p = document.createElement('p');
        p.innerText = resultText;
        p.style.color = answer.correct ? 'green' : 'red';
        detailedResults.appendChild(p);
    });
}

function restartQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    selectedOption = null;
    selectedQuestions = [];
    userAnswers = [];
    document.getElementById('quiz').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    displayPastScores();
}

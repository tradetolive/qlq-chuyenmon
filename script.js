let questions = [];
let currentQuestion = 0;
let userAnswers = {};

async function loadQuestions() {
    const response = await fetch('questions.json');
    questions = await response.json();
    showQuestion();
}

function showQuestion() {
    const q = questions[currentQuestion];
    // Câu hỏi, hỗ trợ HTML, bảng, ảnh, công thức
    document.getElementById('question').innerHTML = `<b>Câu ${currentQuestion + 1}:</b> ${q.question}`;
    // Đáp án
    const answersDiv = document.getElementById('answers');
    answersDiv.innerHTML = '';
    for (const [key, value] of Object.entries(q.options)) {
        if (value && value.trim() !== '') {
            const div = document.createElement('div');
            div.className = 'answer-option' + (userAnswers[q.id] === key ? ' selected' : '');
            div.innerHTML = `
                <label>
                    <input type="radio" name="answer" value="${key}" ${userAnswers[q.id] === key ? 'checked' : ''}>
                    ${value}
                </label>
            `;
            div.onclick = () => {
                userAnswers[q.id] = key;
                showQuestion();
            };
            answersDiv.appendChild(div);
        }
    }
    // Render lại MathJax nếu có công thức toán học
    if (window.MathJax) {
        MathJax.typesetPromise();
    }
    // Ẩn/hiện nút điều hướng
    document.getElementById('prev-btn').disabled = currentQuestion === 0;
    document.getElementById('next-btn').disabled = currentQuestion === questions.length - 1;
    document.getElementById('result').innerHTML = '';
}

document.getElementById('prev-btn').onclick = function() {
    if (currentQuestion > 0) {
        currentQuestion--;
        showQuestion();
    }
};
document.getElementById('next-btn').onclick = function() {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        showQuestion();
    }
};
document.getElementById('submit-btn').onclick = function() {
    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (userAnswers[q.id] && userAnswers[q.id] === q.correct) correct++;
    }
    document.getElementById('result').innerHTML = `Bạn đúng ${correct}/${questions.length} câu (${(correct/questions.length*100).toFixed(1)}%)`;
};

window.onload = loadQuestions;

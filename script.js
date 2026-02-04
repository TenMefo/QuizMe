// ==========================================
// ZMIENNE GLOBALNE
// ==========================================
const STORAGE_KEY = 'quiz_app_saved_decks';

let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let isAnswered = false;
let createdQuestions = [];
let editingIndex = -1;
let wrongAnswers = [];

// ==========================================
// 1. START I NAWIGACJA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            // Fix: Clear previous questions when switching to Creator if user wants a fresh start
            if (tab === 'creator' && createdQuestions.length > 0 && !btn.classList.contains('active')) {
                if (confirm('Czy chcesz stworzyć nowy zestaw od podstaw? Obecne pytania w kreatorze zostaną usunięte.')) {
                    createdQuestions = [];
                    renderPreview();
                    resetCreatorForm();
                }
            }
            switchTab(tab);
        });
    });

    initPlayerEvents();
    initCreatorEvents();
    initEditorEvents();
    renderSavedQuizzesList();
});

function switchTab(tabName) {
    document.querySelectorAll('main.container').forEach(el => el.classList.add('hidden'));
    const activeView = document.getElementById('view-' + tabName);
    if(activeView) activeView.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if(activeBtn) activeBtn.classList.add('active');
}

// ==========================================
// 2. SYSTEM PAMIĘCI (LOCAL STORAGE)
// ==========================================
function getSavedQuizzes() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveQuizToStorage(name, questionsData) {
    const quizzes = getSavedQuizzes();
    const newQuiz = {
        id: Date.now(),
        name: name,
        date: new Date().toLocaleDateString('pl-PL'),
        data: questionsData
    };
    quizzes.push(newQuiz);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
    renderSavedQuizzesList();
}

function deleteQuizFromStorage(id) {
    if(!confirm("Czy na pewno chcesz usunąć ten quiz?")) return;
    let quizzes = getSavedQuizzes();
    quizzes = quizzes.filter(q => q.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
    renderSavedQuizzesList();
}

function renderSavedQuizzesList() {
    const listContainer = document.getElementById('saved-list');
    const wrapper = document.getElementById('saved-quizzes-container');
    const quizzes = getSavedQuizzes();

    if (quizzes.length === 0) {
        wrapper.classList.add('hidden');
        return;
    }
    wrapper.classList.remove('hidden');
    listContainer.innerHTML = '';

    quizzes.forEach(quiz => {
        const item = document.createElement('div');
        item.className = 'saved-item';
        item.innerHTML = `
            <div>
                <div class="saved-info">${quiz.name}</div>
                <span class="saved-date">Data: ${quiz.date} • Pytań: ${quiz.data.length}</span>
            </div>
            <div class="saved-actions">
                <button class="btn-play" data-id="${quiz.id}">Graj</button>
                <button class="btn-trash" data-id="${quiz.id}">Usuń</button>
            </div>
        `;
        listContainer.appendChild(item);
    });
    itemActions(listContainer);
}

function itemActions(container) {
    container.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            const quizzes = getSavedQuizzes();
            const selected = quizzes.find(q => q.id === id);
            if (selected) {
                questions = shuffleArray(selected.data);
                startQuiz();
            }
        });
    });
    container.querySelectorAll('.btn-trash').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteQuizFromStorage(parseInt(e.target.dataset.id));
        });
    });
}

// ==========================================
// 3. ODTWARZACZ (PLAYER)
// ==========================================
function initPlayerEvents() {
    const fileInput = document.getElementById('csvFile');
    const startBtn = document.getElementById('start-btn');
    const nextBtn = document.getElementById('next-btn');
    const checkBtn = document.getElementById('check-btn'); // NOWE
    const restartBtn = document.getElementById('restart-btn');
    const exitBtn = document.getElementById('exit-quiz-btn');
    const backMenuBtn = document.getElementById('back-to-menu-btn');

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            startBtn.disabled = false;
            document.getElementById('error-display').textContent = '';
        }
    });

    startBtn.addEventListener('click', loadAndSaveNewFile);
    
    checkBtn.addEventListener('click', submitMultiAnswer); // NOWE

    nextBtn.addEventListener('click', () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) loadQuestion();
        else showResults();
    });

    restartBtn.addEventListener('click', () => {
        questions = shuffleArray(questions);
        startQuiz();
    });

    const goBack = () => {
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('result-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
        fileInput.value = '';
        startBtn.disabled = true;
    };
    exitBtn.addEventListener('click', goBack);
    backMenuBtn.addEventListener('click', goBack);
}

function loadAndSaveNewFile() {
    const file = document.getElementById('csvFile').files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedData = parseCSV(e.target.result);
            if (parsedData.length === 0) throw new Error("Plik jest pusty.");
            saveQuizToStorage(file.name, parsedData);
            questions = shuffleArray(parsedData);
            startQuiz();
        } catch (err) {
            document.getElementById('error-display').textContent = "Błąd: " + err.message;
        }
    };
    reader.readAsText(file);
}

function startQuiz() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('quiz-screen').classList.remove('hidden');
    currentQuestionIndex = 0;
    score = 0;
    wrongAnswers = [];
    loadQuestion();
}

function loadQuestion() {
    isAnswered = false;
    const nextBtn = document.getElementById('next-btn');
    const checkBtn = document.getElementById('check-btn');
    const answersContainer = document.getElementById('answers-container');
    const explContainer = document.getElementById('explanation-container'); 
    const counterText = document.getElementById('question-counter');
    const questionText = document.getElementById('question-text');

    nextBtn.classList.add('hidden');
    checkBtn.classList.add('hidden');
    explContainer.classList.add('hidden'); 
    answersContainer.innerHTML = '';
    
    const currentQ = questions[currentQuestionIndex];
    counterText.textContent = `Pytanie ${currentQuestionIndex + 1} z ${questions.length}`;
    
    // Sprawdzamy liczbę poprawnych odpowiedzi
    const correctCount = currentQ.answers.filter(a => a.correct).length;
    
    if (correctCount > 1) {
        questionText.innerHTML = currentQ.question + ` <br><small style="font-size: 0.6em; color: #666; font-weight: normal;">(Wybierz ${correctCount} poprawne)</small>`;
    } else {
        questionText.textContent = currentQ.question;
    }
    
    const shuffledAnswers = shuffleArray([...currentQ.answers]);
    shuffledAnswers.forEach(ans => {
        const btn = document.createElement('button');
        btn.classList.add('btn', 'btn-option');
        btn.textContent = ans.text;
        btn.dataset.correct = ans.correct;
        
        if (correctCount > 1) {
            btn.addEventListener('click', (e) => toggleOption(e, checkBtn));
        } else {
            btn.addEventListener('click', selectAnswer);
        }
        answersContainer.appendChild(btn);
    });
}

function toggleOption(e, checkBtn) {
    if (isAnswered) return;
    const btn = e.currentTarget;
    btn.classList.toggle('multi-selected');
    btn.classList.toggle('selected');
    checkBtn.classList.remove('hidden');
}

function submitMultiAnswer() {
    if (isAnswered) return;
    isAnswered = true;
    document.getElementById('check-btn').classList.add('hidden');
    
    const allBtns = document.querySelectorAll('.btn-option');
    let allCorrect = true;
    let anySelected = false;
    
    const userSelected = [];
    const correctAnswersList = [];

    allBtns.forEach(btn => {
        const isSelected = btn.classList.contains('multi-selected');
        const isCorrect = btn.dataset.correct === 'true';
        
        if (isSelected) userSelected.push(btn.textContent);
        if (isCorrect) correctAnswersList.push(btn.textContent);
        
        btn.classList.remove('multi-selected', 'selected');
        btn.disabled = true;
        
        if (isSelected) anySelected = true;

        if (isCorrect) {
            btn.classList.add('correct');
            if (!isSelected) allCorrect = false; // Pominięto poprawną
        } else if (isSelected) {
            btn.classList.add('wrong'); // Zaznaczono błędną
            allCorrect = false; 
        }
    });

    if (allCorrect && anySelected) {
        score++;
    } else {
        wrongAnswers.push({
            question: questions[currentQuestionIndex].question,
            user: userSelected,
            correct: correctAnswersList
        });
    }
    
    showExplanation();
    document.getElementById('next-btn').classList.remove('hidden');
}

function selectAnswer(e) {
    if (isAnswered) return;
    isAnswered = true;
    const selectedBtn = e.target;
    const isCorrect = selectedBtn.dataset.correct === 'true';
    
    if (isCorrect) { 
        selectedBtn.classList.add('correct'); 
        score++; 
    } else { 
        selectedBtn.classList.add('wrong'); 
        
        const correctTexts = [];
        document.querySelectorAll('.btn-option').forEach(b => {
             if(b.dataset.correct === 'true') correctTexts.push(b.textContent);
        });
        
        wrongAnswers.push({
            question: questions[currentQuestionIndex].question,
            user: [selectedBtn.textContent],
            correct: correctTexts
        });
    }

    const allBtns = document.querySelectorAll('.btn-option');
    allBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.correct === 'true') btn.classList.add('correct');
    });
    
    showExplanation();
    document.getElementById('next-btn').classList.remove('hidden');
}

function showExplanation() {
    const currentQ = questions[currentQuestionIndex];
    const explContainer = document.getElementById('explanation-container');
    const explImage = document.getElementById('explanation-image');
    const explText = document.getElementById('explanation-text');
    
    let hasContent = false;

    if (currentQ.image && currentQ.image.trim() !== "") {
        explImage.src = currentQ.image;
        explImage.classList.remove('hidden');
        explImage.style.display = "block";
        hasContent = true;
    } else {
        explImage.classList.add('hidden');
        explImage.style.display = "none";
    }

    if (currentQ.explanation && currentQ.explanation.trim() !== "") {
        explText.textContent = currentQ.explanation;
        explText.classList.remove('hidden');
        hasContent = true;
    } else {
        explText.classList.add('hidden');
    }

    if (hasContent) explContainer.classList.remove('hidden');
}

function showResults() {
    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    const percentage = Math.round((score / questions.length) * 100);
    document.getElementById('final-score').textContent = `${score}/${questions.length}`;
    document.getElementById('final-percent').textContent = `${percentage}%`;

    const reviewContainer = document.getElementById('wrong-answers-review');
    const reviewList = document.getElementById('wrong-answers-list');
    reviewList.innerHTML = '';
    
    if (wrongAnswers.length > 0) {
        reviewContainer.classList.remove('hidden');
        wrongAnswers.forEach((item, index) => {
             const div = document.createElement('div');
             div.classList.add('review-item');
             div.innerHTML = `
                <div class="review-q"><span class="review-index">${index + 1}.</span> ${item.question}</div>
                <div class="review-ans-row">
                    <span class="review-label red">Twoja:</span> <span class="review-text-wrong">${item.user.length > 0 ? item.user.join(', ') : '(brak)'}</span>
                </div>
                <div class="review-ans-row">
                    <span class="review-label green">Poprawna:</span> <span class="review-text-correct">${item.correct.join(', ')}</span>
                </div>
             `;
             reviewList.appendChild(div);
        });
    } else {
        reviewContainer.classList.add('hidden');
    }
}

// ==========================================
// 4. PARSER CSV (Refactored for Multiline Support)
// ==========================================
function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentVal = "";
    let inQuotes = false;
    
    // Normalize newlines
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < cleanText.length; i++) {
        const c = cleanText[i];
        const next = cleanText[i+1];

        if (!inQuotes && c === '"') {
            inQuotes = true;
        } else if (inQuotes && c === '"' && next === '"') {
            currentVal += '"';
            i++;
        } else if (inQuotes && c === '"') {
            inQuotes = false;
        } else if (!inQuotes && c === ',') {
            currentRow.push(currentVal);
            currentVal = "";
        } else if (!inQuotes && c === '\n') {
            currentRow.push(currentVal);
            rows.push(currentRow);
            currentRow = [];
            currentVal = "";
        } else {
            currentVal += c;
        }
    }
    if (currentVal || currentRow.length > 0) {
        currentRow.push(currentVal);
        rows.push(currentRow);
    }
    
    const parsedQuestions = [];
    if (rows.length === 0) return parsedQuestions;

    // Detect format
    const headerRow = rows[0].map(c => c.toLowerCase());
    const headerStr = headerRow.join(',');
    const isV2 = headerStr.includes('wyjaśnienie') || (headerStr.includes('zdjęcie') && headerRow.indexOf('zdjęcie') < 3);

    let startIdx = 0;
    if (headerRow[0] && headerRow[0].startsWith('pytanie')) startIdx = 1;

    for (let i = startIdx; i < rows.length; i++) {
        const parts = rows[i].map(p => p.trim());
        if (parts.length < 2) continue;

        const qText = parts[0];
        let rawAnswers = [];
        let imgUrl = "";
        let explanation = "";

        if (isV2) {
            // Format V2: Pytanie, Zdjęcie, Wyjaśnienie, Odp1, Odp2...
            imgUrl = parts[1] || "";
            explanation = parts[2] || "";
            rawAnswers = parts.slice(3);
        } else {
            // Format V1
            rawAnswers = parts.slice(1, 5); 
            if (parts.length > 5) imgUrl = parts[5];
        }

        const answers = [];
        let correctCount = 0;

        rawAnswers.forEach(ans => {
            if (!ans) return;
            let isCorrect = false;
            let cleanText = ans;
            if (ans.startsWith('*')) {
                isCorrect = true;
                cleanText = ans.substring(1);
                correctCount++;
            }
            if (cleanText !== "") answers.push({ text: cleanText, correct: isCorrect });
        });

        if (answers.length > 0 && correctCount > 0) {
            parsedQuestions.push({ 
                question: qText, 
                answers: answers, 
                image: imgUrl,
                explanation: explanation
            });
        }
    }
    return parsedQuestions;
}

function shuffleArray(array) {
    const newArray = [...array]; 
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// ==========================================
// 6. OBSŁUGA KREATORA I EDYTORA
// ==========================================
function initEditorEvents() {
    const editFileInput = document.getElementById('editCsvFile');
    const loadEditBtn = document.getElementById('load-edit-btn');
    const errorDisplay = document.getElementById('editor-error-display');

    editFileInput.addEventListener('change', () => { if (editFileInput.files.length > 0) loadEditBtn.disabled = false; });

    loadEditBtn.addEventListener('click', () => {
        const file = editFileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const rawParsed = parseCSV(e.target.result);
                if (rawParsed.length === 0) throw new Error("Plik pusty.");
                
                // Konwersja do formatu kreatora
                createdQuestions = rawParsed.map(q => {
                    return {
                        question: q.question,
                        answers: q.answers, // Już są obiektami {text, correct}
                        image: q.image || "",
                        explanation: q.explanation || ""
                    };
                });
                
                renderPreview();
                switchTab('creator');
                editFileInput.value = '';
                loadEditBtn.disabled = true;
                resetCreatorForm();
            } catch (err) {
                errorDisplay.textContent = err.message;
            }
        };
        reader.readAsText(file);
    });
}

function initCreatorEvents() {
    document.getElementById('add-q-btn').addEventListener('click', handleQuestionSubmit);
    document.getElementById('cancel-edit-btn').addEventListener('click', resetCreatorForm);
    document.getElementById('download-btn').addEventListener('click', downloadCSV);
    
    // Nowe: dodawanie dynamiczne odpowiedzi
    document.getElementById('add-answer-btn').addEventListener('click', () => addCreatorAnswerRow());
}

function addCreatorAnswerRow(text = "", isCorrect = false) {
    const container = document.getElementById('creator-answers-wrapper');
    const div = document.createElement('div');
    div.classList.add('creator-answer-row');
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCorrect;
    checkbox.style.marginRight = "10px";
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = text;
    input.placeholder = "Treść odpowiedzi...";
    input.style.flexGrow = "1";
    
    const removeBtn = document.createElement('button');
    removeBtn.classList.add('btn-remove-ans');
    removeBtn.innerHTML = "&times;"; // X
    removeBtn.title = "Usuń";
    removeBtn.addEventListener('click', () => div.remove());
    
    div.appendChild(checkbox);
    div.appendChild(input);
    div.appendChild(removeBtn);
    container.appendChild(div);
}

function handleQuestionSubmit() {
    const qText = document.getElementById('new-q-text').value.trim();
    const qImage = document.getElementById('new-q-image').value.trim();
    const qExpl = document.getElementById('new-q-explanation').value.trim();
    
    const rows = document.querySelectorAll('#creator-answers-wrapper .creator-answer-row');
    const answers = [];
    let hasCorrect = false;

    rows.forEach(row => {
        const textInput = row.querySelector('input[type="text"]');
        const checkInput = row.querySelector('input[type="checkbox"]');
        if (textInput.value.trim() !== "") {
            answers.push({ text: textInput.value.trim(), correct: checkInput.checked });
            if (checkInput.checked) hasCorrect = true;
        }
    });

    if (!qText || answers.length < 2 || !hasCorrect) {
        alert("Wpisz pytanie, dodaj min. 2 odpowiedzi i zaznacz poprawną."); 
        return; 
    }

    const questionData = {
        question: qText,
        answers: answers,
        image: qImage,
        explanation: qExpl
    };

    if (editingIndex === -1) createdQuestions.push(questionData);
    else createdQuestions[editingIndex] = questionData;

    resetCreatorForm();
    renderPreview();
}

function loadQuestionForEdit(index) {
    const q = createdQuestions[index];
    document.getElementById('new-q-text').value = q.question;
    document.getElementById('new-q-image').value = q.image || "";
    document.getElementById('new-q-explanation').value = q.explanation || "";

    const container = document.getElementById('creator-answers-wrapper');
    container.innerHTML = "";
    
    q.answers.forEach(ans => addCreatorAnswerRow(ans.text, ans.correct));

    editingIndex = index;
    const addBtn = document.getElementById('add-q-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    addBtn.textContent = "Zapisz zmiany";
    addBtn.style.backgroundColor = "#ff9800";
    cancelBtn.classList.remove('hidden');
    document.querySelector('.creator-form').scrollIntoView({ behavior: 'smooth' });
}

function resetCreatorForm() {
    editingIndex = -1;
    document.getElementById('new-q-text').value = "";
    document.getElementById('new-q-image').value = "";
    document.getElementById('new-q-explanation').value = "";
    
    const container = document.getElementById('creator-answers-wrapper');
    container.innerHTML = "";
    // Domyślnie dodaj 2 puste
    addCreatorAnswerRow();
    addCreatorAnswerRow();

    const addBtn = document.getElementById('add-q-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    addBtn.textContent = "+ Dodaj pytanie do listy";
    addBtn.style.backgroundColor = "";
    cancelBtn.classList.add('hidden');
}

function renderPreview() {
    const container = document.getElementById('preview-container');
    document.getElementById('count-display').textContent = createdQuestions.length;
    document.getElementById('download-btn').disabled = createdQuestions.length === 0;
    container.innerHTML = "";

    createdQuestions.forEach((q, idx) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        
        let ansHtml = q.answers.map(a => 
            `<div class="preview-ans ${a.correct ? 'is-correct' : ''}">${a.correct ? '✔ ' : '- '}${a.text}</div>`
        ).join('');
        
        const imgIcon = q.image ? '<span style="font-size:0.8rem; color:#2196F3;"> 🖼️</span>' : '';
        const expIcon = q.explanation ? '<span style="font-size:0.8rem; color:#4CAF50;"> 📝</span>' : '';

        div.innerHTML = `
            <div class="preview-question">${idx+1}. ${q.question} ${imgIcon}${expIcon}</div>
            ${ansHtml}
            <button class="btn-edit" data-index="${idx}">Edytuj</button>
            <button class="btn-delete" data-index="${idx}">Usuń</button>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => loadQuestionForEdit(parseInt(e.target.dataset.index))));
    container.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', (e) => {
        const idxToDelete = parseInt(e.target.dataset.index);
        if (idxToDelete === editingIndex) resetCreatorForm();
        else if (idxToDelete < editingIndex) editingIndex--;
        createdQuestions.splice(idxToDelete, 1);
        renderPreview();
    }));
}

function downloadCSV() {
    if (createdQuestions.length === 0) return;
    
    // Znajdź maksymalną liczbę odpowiedzi
    const maxAns = Math.max(...createdQuestions.map(q => q.answers.length));
    
    // Generuj nagłówek V2
    let header = "Pytanie,Zdjęcie,Wyjaśnienie";
    for(let i=1; i<=maxAns; i++) header += `,Odpowiedź ${i}`;
    header += "\n";
    
    let csv = header;

    const escape = (t) => {
        if (!t) return "";
        if (t.includes('"') || t.includes(',') || t.includes('\n') || t.includes('\r')) {
            return `"${t.replace(/"/g, '""')}"`;
        }
        return t;
    };
    
    createdQuestions.forEach(q => {
        let row = [
            escape(q.question),
            escape(q.image),
            escape(q.explanation)
        ];
        
        q.answers.forEach(a => {
            // Internal structure is expected to be {text, correct}
            row.push(escape((a.correct ? "*" : "") + a.text));
        });
        
        csv += row.join(",") + "\n";
    });
    
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8;'}));
    link.download = "quiz_generator.csv";
    link.click();
}
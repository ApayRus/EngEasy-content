let wordsData = {}
let indexData = null
let loadedChunks = new Set()

// Загружаем индекс
fetch('/cartoon-word-stats/chunks/index.json')
	.then(response => response.json())
	.then(index => {
		indexData = index
		// Загружаем первый чанк
		return loadChunk(0)
	})
	.then(() => {
		renderWords()
	})
	.catch(error => {
		console.error('Ошибка загрузки данных:', error)
		document.getElementById('wordList').innerHTML =
			'<div class="no-results">Ошибка загрузки данных</div>'
	})

async function loadChunk(chunkNum) {
	if (loadedChunks.has(chunkNum)) return

	try {
		const response = await fetch(`/cartoon-word-stats/chunks/chunk-${chunkNum}.json`)
		const chunkData = await response.json()
		Object.assign(wordsData, chunkData)
		loadedChunks.add(chunkNum)
	} catch (error) {
		console.error(`Ошибка загрузки чанка ${chunkNum}:`, error)
	}
}

let currentLimit = 100

async function renderWords(filter = '', limit = currentLimit) {
	const wordList = document.getElementById('wordList')

	if (!indexData) return

	let wordsToShow
	let needLoadAll = false

	if (filter) {
		const lowerFilter = filter.toLowerCase()

		// Сначала ищем леммы, которые начинаются с введённого текста
		const matchingLemmas = indexData.words.filter(word =>
			word.toLowerCase().startsWith(lowerFilter)
		)

		// Если нашли леммы - используем их
		if (matchingLemmas.length > 0) {
			wordsToShow = matchingLemmas
		} else {
			// Если не нашли - нужно загрузить все чанки и искать по формам
			needLoadAll = true
			wordsToShow = indexData.words
		}
	} else {
		// Берем первые N слов
		wordsToShow = indexData.words.slice(0, limit)
	}

	// Определяем какие чанки нужно загрузить
	const chunksNeeded = new Set()

	if (needLoadAll || filter) {
		// При поиске загружаем все чанки
		const totalChunks = indexData.chunksCount
		for (let i = 0; i < totalChunks; i++) {
			chunksNeeded.add(i)
		}
	} else {
		// Без поиска - только нужные чанки
		wordsToShow.forEach(word => {
			const idx = indexData.words.indexOf(word)
			const chunkNum = Math.floor(idx / indexData.chunkSize)
			chunksNeeded.add(chunkNum)
		})
	}

	// Загружаем недостающие чанки
	const loadPromises = []
	for (const chunkNum of chunksNeeded) {
		if (!loadedChunks.has(chunkNum)) {
			loadPromises.push(loadChunk(chunkNum))
		}
	}

	if (loadPromises.length > 0) {
		await Promise.all(loadPromises)
	}

	// Фильтруем: ищем по леммам И по всем формам
	const filtered = indexData.words.filter(word => {
		const data = wordsData[word]
		if (!data) return false
		if (!filter) return indexData.words.indexOf(word) < limit

		const lowerFilter = filter.toLowerCase()
		// Проверяем лемму
		if (word.toLowerCase().startsWith(lowerFilter)) return true
		// Проверяем все формы
		return Object.keys(data.forms).some(form =>
			form.toLowerCase().startsWith(lowerFilter)
		)
	})

	if (filtered.length === 0) {
		wordList.innerHTML = '<div class="no-results">Ничего не найдено</div>'
		const listInfo = document.getElementById('listInfo')
		listInfo.textContent = 'Ничего не найдено'
		return
	}

	const html = filtered
		.map(word => {
			const data = wordsData[word]
			const lemma = word
			const formsCount = Object.keys(data.forms).length
			const expansions = data.expansions || {}
			const formsHtml = Object.entries(data.forms)
				.map(([form, count]) => {
					const expansion = expansions[form]
					const titleAttr = expansion ? ` title="${expansion}"` : ''
					const expansionHtml = expansion
						? `<span class="form-expansion" title="${expansion}">💬</span>`
						: ''
					return `<div class="form-item"${titleAttr}>
					<span class="form-word">${form}</span>
					${expansionHtml}
					<span class="form-count">${count.toLocaleString()}</span>
				</div>`
				})
				.join('')

			return `
			<div class="word-item">
				<div class="word-header" onclick="toggleForms(this)">
					<div>
						<span class="word-lemma">${lemma}</span>
						${
							formsCount > 1
								? ` <span style="color: #888; font-size: 0.9em;">(${formsCount} форм)</span>`
								: ''
						}
					</div>
					<div>
						<span class="word-total">${data.total.toLocaleString()}</span>
						${formsCount > 1 ? '<span class="toggle-icon">▼</span>' : ''}
					</div>
				</div>
				${formsCount > 1 ? `<div class="word-forms">${formsHtml}</div>` : ''}
			</div>
		`
		})
		.join('')

	wordList.innerHTML = html

	// Обновляем информацию о списке
	const listInfo = document.getElementById('listInfo')
	if (filter) {
		listInfo.textContent = `Найдено: ${filtered.length.toLocaleString()} слов`
	} else {
		listInfo.textContent = `Показано: ${Math.min(
			limit,
			indexData.totalWords
		).toLocaleString()} из ${indexData.totalWords.toLocaleString()} слов`
	}

	// Добавляем кнопку "Показать больше" если нет фильтра и есть еще записи
	if (!filter && limit < indexData.totalWords) {
		const loadMoreBtn = document.createElement('div')
		loadMoreBtn.style.cssText = 'text-align: center; margin: 30px 0;'
		const btnStyle = `
			padding: 15px 40px;
			font-size: 1.1em;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			border: none;
			border-radius: 10px;
			cursor: pointer;
			font-weight: 600;
			transition: transform 0.2s, box-shadow 0.2s;
			margin: 0 10px;
		`
		loadMoreBtn.innerHTML = `
			<button onclick="loadMore()" style="${btnStyle}"
			   onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.2)'" 
			   onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
				Показать ещё 100
			</button>
			<button onclick="loadAll()" style="${btnStyle}"
			   onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.2)'" 
			   onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
				Показать все (${(indexData.totalWords - limit).toLocaleString()} осталось)
			</button>
		`
		wordList.appendChild(loadMoreBtn)
	}
}

async function loadMore() {
	currentLimit += 100
	await renderWords('', currentLimit)
}

async function loadAll() {
	currentLimit = indexData.totalWords
	await renderWords('', currentLimit)
}

function toggleForms(header) {
	const forms = header.nextElementSibling
	if (forms && forms.classList.contains('word-forms')) {
		forms.classList.toggle('active')
		const icon = header.querySelector('.toggle-icon')
		if (icon) {
			icon.textContent = forms.classList.contains('active') ? '▲' : '▼'
		}
	}
}

// Поиск
document.getElementById('searchInput').addEventListener('input', e => {
	currentLimit = 100 // Сбрасываем лимит при поиске
	renderWords(e.target.value)
})

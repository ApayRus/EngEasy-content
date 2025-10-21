let wordsData = {}
let loadedChunks = new Set()
let indexData = null
let chart = null
let currentPage = 0
let wordsPerPage = 50
let isSearchMode = false

// Определяем мобильное устройство
const isMobile = window.innerWidth <= 768

// На мобильных по умолчанию показываем меньше слов
if (isMobile) {
	wordsPerPage = 20
}

// Загружаем индекс
fetch('/cartoon-word-stats/chunks/index.json')
	.then(response => response.json())
	.then(index => {
		indexData = index

		// Обновляем активную кнопку для мобильных
		if (isMobile) {
			document.querySelectorAll('.btn-group .btn').forEach(btn => {
				btn.classList.remove('active')
				if (btn.textContent.includes('20')) {
					btn.classList.add('active')
				}
			})
		}

		// Загружаем первый чанк
		loadChunksForPage(0)
	})

async function setWordsPerPage(count) {
	wordsPerPage = count
	currentPage = 0
	await loadChunksForPage(0)

	// Обновляем активную кнопку
	document
		.querySelectorAll('.btn-group .btn')
		.forEach(btn => btn.classList.remove('active'))
	event.target.classList.add('active')
}

async function previousPage() {
	if (currentPage > 0) {
		currentPage--
		await loadChunksForPage(currentPage)
	}
}

async function nextPage() {
	const maxPage = Math.ceil(indexData.totalWords / wordsPerPage) - 1
	if (currentPage < maxPage) {
		currentPage++
		await loadChunksForPage(currentPage)
	}
}

async function loadChunksForPage(page) {
	const startIdx = page * wordsPerPage
	const endIdx = startIdx + wordsPerPage

	// Определяем какие чанки нужны
	const startChunk = Math.floor(startIdx / 100)
	const endChunk = Math.floor(endIdx / 100)

	// Загружаем недостающие чанки
	const loadPromises = []
	for (let chunkNum = startChunk; chunkNum <= endChunk; chunkNum++) {
		if (!loadedChunks.has(chunkNum) && chunkNum < indexData.chunksCount) {
			loadPromises.push(loadChunk(chunkNum))
		}
	}

	if (loadPromises.length > 0) {
		await Promise.all(loadPromises)
	}

	renderChart()
}

async function loadChunk(chunkNum) {
	try {
		const response = await fetch(`/cartoon-word-stats/chunks/chunk-${chunkNum}.json`)
		const chunkData = await response.json()

		// Добавляем данные чанка в общий объект
		Object.assign(wordsData, chunkData)
		loadedChunks.add(chunkNum)

		console.log(`Загружен чанк ${chunkNum}`)
	} catch (error) {
		console.error(`Ошибка загрузки чанка ${chunkNum}:`, error)
	}
}

function renderChart() {
	if (isSearchMode) return

	const startIdx = currentPage * wordsPerPage
	const endIdx = startIdx + wordsPerPage

	// Получаем слова для текущей страницы из индекса
	const pageWords = indexData.words.slice(startIdx, endIdx)

	// Создаем entries из загруженных данных
	const entries = pageWords
		.map(word => [word, wordsData[word]])
		.filter(([word, data]) => data) // Только если данные загружены

	updateChart(entries)
	updateNavigation()
}

function updateChart(entries) {
	const labels = entries.map(([word]) => word)
	const values = entries.map(([, data]) => data.total)

	// Генерируем градиент цветов от фиолетового к синему
	const colors = entries.map((_, i) => {
		const ratio = i / entries.length
		const hue = 250 - ratio * 30 // От фиолетового (280) к синему (250)
		const lightness = 55 + ratio * 10 // Небольшое изменение яркости
		return `hsla(${hue}, 70%, ${lightness}%, 0.85)`
	})

	const ctx = document.getElementById('wordChart').getContext('2d')

	if (chart) {
		chart.destroy()
	}

	chart = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: labels,
			datasets: [
				{
					label: 'Частота',
					data: values,
					backgroundColor: colors,
					borderColor: colors.map(c => c.replace('0.85', '1')),
					borderWidth: 2,
					borderRadius: 6,
					hoverBackgroundColor: colors.map(c => c.replace('0.85', '0.95')),
					barPercentage: 0.95,
					categoryPercentage: 1.0
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			onClick: (event, elements) => {
				if (elements.length > 0) {
					const index = elements[0].index
					const word = labels[index]
					showWordDetails(word)
				}
			},
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					backgroundColor: 'rgba(0, 0, 0, 0.8)',
					padding: 15,
					titleFont: {
						size: 16,
						weight: 'bold'
					},
					bodyFont: {
						size: 14
					},
					callbacks: {
						title: function (context) {
							return context[0].label
						},
						label: function (context) {
							const word = context.label
							const data = wordsData[word]
							const formsCount = Object.keys(data.forms).length
							const forms = Object.keys(data.forms).slice(0, 3).join(', ')
							return [
								`Всего: ${context.parsed.y.toLocaleString()}`,
								formsCount > 1 ? `Форм: ${formsCount} (${forms}...)` : '',
								'',
								'🖱️ Кликните для деталей'
							].filter(Boolean)
						}
					}
				}
			},
			scales: {
				y: {
					beginAtZero: true,
					title: {
						display: !isMobile,
						text: 'Количество упоминаний',
						font: {
							size: 16,
							weight: 'bold'
						},
						color: '#333'
					},
					ticks: {
						font: {
							size: isMobile ? 8 : 16
						},
						callback: function (value) {
							// Форматируем большие числа: 2500 -> 2.5k, 1000 -> 1k
							if (value >= 1000) {
								return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
							}
							return value
						}
					},
					grid: {
						color: 'rgba(0, 0, 0, 0.05)'
					}
				},
				x: {
					title: {
						display: !isMobile,
						text: 'Слова (используйте стрелки для навигации)',
						font: {
							size: 14,
							weight: 'bold'
						},
						color: '#333'
					},
					ticks: {
						font: {
							size: (() => {
								// Размер шрифта зависит от количества слов
								if (wordsPerPage === 20) {
									return isMobile ? 14 : 24
								} else if (wordsPerPage === 50) {
									return isMobile ? 9 : 20
								} else {
									return isMobile ? 7 : 14
								}
							})(),
							weight: '500'
						},
						color: '#333',
						maxRotation: 90,
						minRotation: 90,
						autoSkip: false,
						maxTicksLimit: isMobile ? wordsPerPage : undefined
					},
					grid: {
						display: false
					}
				}
			},
			animation: {
				duration: 750,
				easing: 'easeInOutQuart'
			}
		}
	})
}

function updateNavigation() {
	const totalWords = indexData.totalWords
	const maxPage = Math.ceil(totalWords / wordsPerPage) - 1
	const startIdx = currentPage * wordsPerPage + 1
	const endIdx = Math.min((currentPage + 1) * wordsPerPage, totalWords)

	document.getElementById('prevBtn').disabled = currentPage === 0
	document.getElementById('nextBtn').disabled = currentPage >= maxPage
	document.getElementById(
		'positionInfo'
	).textContent = `${startIdx}-${endIdx} из ${totalWords.toLocaleString()}`

	document.getElementById(
		'chartInfo'
	).textContent = `Показаны слова с ${startIdx} по ${endIdx} ранг. Всего лексем: ${totalWords.toLocaleString()}`
}

function showWordDetails(word) {
	const data = wordsData[word]
	if (!data) return

	const formsCount = Object.keys(data.forms).length
	const expansions = data.expansions || {}

	// Вычисляем ранг слова
	const rank = indexData.words.indexOf(word) + 1

	let html = `
		<h2>#${rank} ${word}</h2>
		<div class="stats">
			<div class="stat-card">
				<div class="stat-value">${data.total.toLocaleString()}</div>
				<div class="stat-label">Всего упоминаний</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">${formsCount}</div>
				<div class="stat-label">Различных форм</div>
			</div>
			<div class="stat-card">
				<div class="stat-value">${Object.keys(expansions).length}</div>
				<div class="stat-label">Расшифровок</div>
			</div>
		</div>
		
		<div class="detail-section">
			<h3>Все формы слова "${word}":</h3>
			<div class="forms-grid">
	`

	// Сортируем формы по частоте
	const sortedForms = Object.entries(data.forms).sort((a, b) => b[1] - a[1])

	sortedForms.forEach(([form, count]) => {
		const expansion = expansions[form]
		const percentage = ((count / data.total) * 100).toFixed(1)
		html += `
			<div class="form-card">
				<div class="form-word">${form}</div>
				<div class="form-count">📊 ${count.toLocaleString()} (${percentage}%)</div>
				${expansion ? `<div class="form-expansion">💬 ${expansion}</div>` : ''}
			</div>
		`
	})

	html += `
			</div>
		</div>
	`

	document.getElementById('detailsContent').innerHTML = html
	document.getElementById('wordDetails').classList.add('active')
	document
		.getElementById('wordDetails')
		.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function closeDetails() {
	document.getElementById('wordDetails').classList.remove('active')
}

// Навигация клавиатурой
document.addEventListener('keydown', e => {
	if (isSearchMode) return

	if (e.key === 'ArrowLeft') {
		previousPage()
	} else if (e.key === 'ArrowRight') {
		nextPage()
	}
})

// Поддержка свайпов на мобильных
let touchStartX = 0
let touchEndX = 0

const chartWrapper = document.querySelector('.chart-wrapper')

chartWrapper.addEventListener('touchstart', e => {
	touchStartX = e.changedTouches[0].screenX
})

chartWrapper.addEventListener('touchend', e => {
	touchEndX = e.changedTouches[0].screenX
	handleSwipe()
})

function handleSwipe() {
	const swipeThreshold = 50 // минимальное расстояние для свайпа

	if (touchEndX < touchStartX - swipeThreshold) {
		// Свайп влево - следующая страница
		nextPage()
	}

	if (touchEndX > touchStartX + swipeThreshold) {
		// Свайп вправо - предыдущая страница
		previousPage()
	}
}

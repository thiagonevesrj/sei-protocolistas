/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const sourceDirectory = path.resolve(process.argv[2] || path.join(root, '..', 'trello_sources'))
const outputPath = path.join(root, 'data', 'catalogo-scripts.json')

const retiredCardIds = new Set([
  '665a8e0b87370831e17d0e34',
  '65ba535492f507717a7156c5',
  '65a7f475c8716fc2780992a1',
  '64de9b1c265879d14ae5991f',
  '66144fd8750811180ba54a3a'
])

const phases = {
  'SCRIPTS - FASE01 - Identificação': { id: 'identificacao', label: 'Identificação', order: 1 },
  'SCRIPTS - FASE02 - Orientação': { id: 'orientacao', label: 'Orientação', order: 2 },
  'SCRIPTS - FASE03 - Protocolos': { id: 'protocolos', label: 'Protocolos', order: 3 },
  'SCRIPTS - EX - Exigencias / AG - Agendamento': { id: 'atendimento', label: 'Exigências e finalização', order: 4 }
}

function fail (message) {
  console.error(message)
  process.exit(1)
}

if (!fs.existsSync(sourceDirectory)) {
  fail(`Diretório com exportações do Trello não encontrado: ${sourceDirectory}`)
}

const files = fs.readdirSync(sourceDirectory)
  .filter((file) => file.endsWith('.json'))

const scripts = []
const sourceBoards = []

files.forEach((file) => {
  const board = JSON.parse(fs.readFileSync(path.join(sourceDirectory, file), 'utf8'))
  const phase = phases[board.name]
  if (!phase) return

  const lists = new Map((board.lists || []).map((list) => [list.id, list]))
  const activeCards = (board.cards || []).filter((card) => !card.closed)

  sourceBoards.push({
    name: board.name,
    exportedAt: board.dateLastActivity || null,
    activeCards: activeCards.length
  })

  activeCards.forEach((card) => {
    if (retiredCardIds.has(card.id)) return

    const list = lists.get(card.idList)
    scripts.push({
      id: `trello-${card.id}`,
      title: String(card.name || '').trim(),
      phase: phase.id,
      phaseLabel: phase.label,
      group: String(list?.name || 'Sem grupo').trim(),
      body: String(card.desc || '').trim(),
      status: 'legado-vigente',
      source: {
        board: board.name,
        cardId: card.id,
        lastActivity: card.dateLastActivity || null
      }
    })
  })
})

scripts.sort((a, b) => {
  const phaseOrder = phases[a.source.board].order - phases[b.source.board].order
  if (phaseOrder !== 0) return phaseOrder
  return `${a.group} ${a.title}`.localeCompare(`${b.group} ${b.title}`, 'pt-BR')
})

if (scripts.length !== 176) {
  fail(`Catálogo inesperado: ${scripts.length} scripts. Esperados: 176.`)
}

const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'Exportações oficiais do Trello',
  originalActiveCards: 181,
  retiredDuplicateCards: Array.from(retiredCardIds),
  activeScripts: scripts.length,
  phases: Object.values(phases)
    .sort((a, b) => a.order - b.order)
    .map(({ id, label }) => ({ id, label })),
  sourceBoards,
  actionableScripts: scripts.filter((script) => script.body).length,
  emptyCards: scripts.filter((script) => !script.body).map((script) => script.source.cardId),
  scripts
}

fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Catálogo gerado com ${scripts.length} scripts em ${outputPath}`)

/* eslint-env node */
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const sourceDirectory = path.resolve(process.argv[2] || path.join(root, '..', 'trello_sources'))
const attachmentDirectory = path.resolve(process.argv[3] || path.join(sourceDirectory, 'attachments'))
const outputPath = path.resolve(process.argv[4] || path.join(root, 'data', 'catalogo-scripts.json'))

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

function normalizeFileName (value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim()
}

function listFilesRecursively (directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFilesRecursively(entryPath) : [entryPath]
  })
}

const localAttachmentFiles = listFilesRecursively(attachmentDirectory)

function isScriptTextAttachment (attachment) {
  const name = String(attachment?.name || '')
  return /\.txt$/i.test(name) && !/destino[\s_]+do[\s_]+processo/i.test(name)
}

function findLocalAttachment (card, attachment) {
  const expectedName = normalizeFileName(attachment.name)
  const ranked = localAttachmentFiles
    .filter((file) => /\.txt$/i.test(file))
    .map((file) => {
      const normalizedPath = normalizeFileName(file)
      const normalizedBase = normalizeFileName(path.basename(file))
      let score = 0
      if (normalizedPath.includes(String(attachment.id || '').toLowerCase())) score += 100
      if (normalizedPath.includes(String(card.id || '').toLowerCase())) score += 80
      if (normalizedBase === expectedName) score += 40
      return { file, score }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.file || null
}

function attachedScriptBody (card) {
  const attachments = (card.attachments || [])
    .filter(isScriptTextAttachment)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  for (const attachment of attachments) {
    const localPath = findLocalAttachment(card, attachment)
    if (!localPath) continue
    const body = fs.readFileSync(localPath, 'utf8').trim()
    if (body) return { body, attachment }
  }

  return null
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
    const attachedScript = attachedScriptBody(card)
    scripts.push({
      id: `trello-${card.id}`,
      title: String(card.name || '').trim(),
      phase: phase.id,
      phaseLabel: phase.label,
      group: String(list?.name || 'Sem grupo').trim(),
      body: attachedScript?.body || String(card.desc || '').trim(),
      status: 'legado-vigente',
      source: {
        board: board.name,
        cardId: card.id,
        lastActivity: card.dateLastActivity || null,
        bodySource: attachedScript ? 'txt-attachment' : 'card-description',
        attachment: attachedScript
          ? { id: attachedScript.attachment.id, name: attachedScript.attachment.name }
          : null
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

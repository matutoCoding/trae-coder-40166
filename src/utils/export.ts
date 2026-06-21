import type {
  CaseInfo, RecordingFile, Speaker, TranscriptionSegment
} from '@shared/types'
import { SPEAKER_ROLE_LABELS, NOTE_TYPE_LABELS, RECORDING_TYPE_LABELS } from '@shared/types'
import { formatTime, formatTimeHMS, formatFileSize } from '@shared/utils'

interface ExportData {
  caseInfo: CaseInfo
  recordingFile: RecordingFile
  speakers: Speaker[]
  segments: TranscriptionSegment[]
  totalDuration: number
}

const LINES_PER_PAGE = 32

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function exportRecordPackage(data: ExportData): Promise<void> {
  const { caseInfo, recordingFile, speakers, segments, totalDuration } = data

  const result = await window.electronAPI.showSaveDialog({
    title: '导出会议记录包',
    defaultPath: `${caseInfo.caseNumber || caseInfo.caseName}_会议记录.html`,
    filters: [
      { name: 'HTML文档', extensions: ['html'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })

  if (result.canceled || !result.filePath) return

  const html = generateFullRecordHTML(data)
  const json = JSON.stringify({
    caseInfo,
    recordingFile,
    speakers,
    segments,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  }, null, 2)

  const fullHtml = html.replace('<!-- JSON_DATA_PLACEHOLDER -->', `
<script type="application/json" id="record-json-data">
${escapeHtml(json)}
</script>`)

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filePath.split(/[\\/]/).pop() || '会议记录.html'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  alert(`会议记录已成功导出！\n\n文件：${result.filePath}\n包含内容：\n  · 封面页（案件信息）\n  · 音频索引（共 ${segments.length} 条）\n  · 发言转写正文\n  · ${segments.filter(s => s.note).length} 条审阅备注\n  · 签名确认页`)
}

function paginateSegments(segments: TranscriptionSegment[]) {
  const pages: TranscriptionSegment[][] = [[]]
  let currentPage = pages[0]
  let lineCount = 8

  segments.forEach(seg => {
    const textLines = Math.ceil(seg.text.length / 42)
    const noteLines = seg.note ? Math.ceil(seg.note.length / 42) + 2 : 0
    const segLines = 3 + textLines + noteLines + (seg.isOverlapping || seg.needsReview ? 1 : 0)

    if (lineCount + segLines > LINES_PER_PAGE && currentPage.length > 0) {
      pages.push([])
      currentPage = pages[pages.length - 1]
      lineCount = 8
    }

    currentPage.push(seg)
    lineCount += segLines
  })

  return pages
}

function generateFullRecordHTML(data: ExportData): string {
  const { caseInfo, recordingFile, speakers, segments, totalDuration } = data
  const paginated = paginateSegments(segments)
  const totalPages = paginated.length + 2
  const now = new Date()

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(caseInfo.caseName)} - 会议记录</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Songti SC", "SimSun", "STSong", serif;
    font-size: 14px;
    line-height: 1.8;
    color: #1a1a1a;
    background: #e5e7eb;
    padding: 20px;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 20px;
    background: white;
    padding: 25mm 22mm;
    position: relative;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    page-break-after: always;
  }
  .page-header {
    position: absolute;
    top: 12mm;
    left: 22mm;
    right: 22mm;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #666;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
  }
  .page-footer {
    position: absolute;
    bottom: 15mm;
    left: 22mm;
    right: 22mm;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #666;
    border-top: 1px solid #ccc;
    padding-top: 4px;
  }
  .cover-title {
    text-align: center;
    margin-top: 30mm;
    margin-bottom: 15mm;
  }
  .cover-title .label {
    font-size: 16px;
    letter-spacing: 8px;
    color: #555;
    margin-bottom: 8mm;
  }
  .cover-title .main {
    font-size: 32px;
    font-weight: bold;
    letter-spacing: 4px;
    margin-bottom: 6mm;
  }
  .cover-title .sub {
    font-size: 18px;
    color: #555;
    letter-spacing: 2px;
  }
  .cover-info {
    margin: 20mm auto 0;
    max-width: 130mm;
    border: 1px solid #333;
    border-collapse: collapse;
  }
  .cover-info td {
    padding: 3mm 5mm;
    border: 1px solid #333;
    font-size: 14px;
    vertical-align: top;
  }
  .cover-info td.label {
    width: 35mm;
    background: #f5f5f5;
    font-weight: bold;
    text-align: right;
  }
  .cover-bottom {
    position: absolute;
    bottom: 40mm;
    left: 22mm;
    right: 22mm;
    text-align: center;
    font-size: 13px;
    color: #555;
  }
  .section-title {
    font-size: 18px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 6mm;
    padding-bottom: 3mm;
    border-bottom: 2px solid #333;
    letter-spacing: 3px;
  }
  .index-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4mm;
  }
  .index-table th, .index-table td {
    border: 1px solid #999;
    padding: 2mm 3mm;
    font-size: 12px;
    text-align: left;
    vertical-align: middle;
  }
  .index-table th {
    background: #f0f0f0;
    font-weight: bold;
    text-align: center;
  }
  .index-table td.num { text-align: center; width: 12mm; }
  .index-table td.time { text-align: center; width: 30mm; font-family: monospace; }
  .index-table td.page { text-align: center; width: 12mm; }
  .index-table td.speaker { width: 22mm; }
  .seg-item {
    margin-bottom: 4mm;
    padding-bottom: 3mm;
    border-bottom: 1px dashed #ddd;
  }
  .seg-item:last-child { border-bottom: none; }
  .seg-header {
    display: flex;
    align-items: center;
    gap: 3mm;
    margin-bottom: 1.5mm;
    font-size: 12px;
  }
  .seg-num {
    font-weight: bold;
    padding: 1px 6px;
    background: #333;
    color: white;
    border-radius: 3px;
    font-size: 11px;
  }
  .seg-speaker {
    font-weight: bold;
  }
  .seg-role {
    padding: 1px 6px;
    background: #eef;
    border-radius: 3px;
    font-size: 11px;
  }
  .seg-time {
    color: #666;
    font-family: monospace;
    font-size: 11px;
  }
  .seg-tag {
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: bold;
  }
  .seg-tag.overlap { background: #fed7aa; color: #9a3412; }
  .seg-tag.review { background: #fecaca; color: #b91c1c; }
  .seg-text {
    font-size: 14px;
    line-height: 2;
    text-indent: 2em;
    text-align: justify;
  }
  .seg-note {
    margin-top: 2mm;
    padding: 2mm 3mm;
    border-left: 3px solid #333;
    background: #f9f9f9;
    font-size: 12px;
  }
  .seg-note-label {
    font-weight: bold;
    color: #333;
    margin-bottom: 1mm;
    font-size: 12px;
  }
  .seg-note.key_commitment { border-left-color: #d97706; background: #fffbeb; }
  .seg-note.factual_statement { border-left-color: #16a34a; background: #f0fdf4; }
  .seg-note.disputed { border-left-color: #dc2626; background: #fef2f2; }
  .seg-note.warning { border-left-color: #ea580c; background: #fff7ed; }
  .seg-note.info { border-left-color: #2563eb; background: #eff6ff; }
  .sign-section {
    margin-top: 10mm;
  }
  .sign-row {
    margin-bottom: 8mm;
  }
  .sign-label {
    font-size: 13px;
    margin-bottom: 8mm;
    font-weight: bold;
  }
  .sign-line {
    border-bottom: 1px solid #333;
    margin-bottom: 2mm;
    height: 12mm;
    position: relative;
  }
  .sign-line .hint {
    position: absolute;
    bottom: 2mm;
    font-size: 11px;
    color: #999;
  }
  .sign-date {
    font-size: 12px;
    color: #666;
  }
  .note-key {
    position: absolute;
    top: 20mm;
    right: 22mm;
    font-size: 10px;
    color: #666;
    text-align: right;
  }
  @media print {
    body { background: white; padding: 0; }
    .page { box-shadow: none; margin: 0; }
  }
</style>
</head>
<body>

<div class="page">
  <div class="cover-title">
    <div class="label">会 议 记 录</div>
    <div class="main">${escapeHtml(caseInfo.caseName)}</div>
    <div class="sub">${RECORDING_TYPE_LABELS[caseInfo.recordingType]}取证材料</div>
  </div>

  <table class="cover-info">
    <tr><td class="label">案件编号</td><td>${escapeHtml(caseInfo.caseNumber || '—')}</td></tr>
    <tr><td class="label">案件类型</td><td>${RECORDING_TYPE_LABELS[caseInfo.recordingType]}</td></tr>
    <tr><td class="label">会议日期</td><td>${escapeHtml(caseInfo.date)}</td></tr>
    <tr><td class="label">会议地点</td><td>${escapeHtml(caseInfo.location || '—')}</td></tr>
    <tr><td class="label">参会人员</td><td>${escapeHtml(caseInfo.participants || speakers.map(s => `${s.name}（${SPEAKER_ROLE_LABELS[s.role]}）`).join('、'))}</td></tr>
    <tr><td class="label">录音文件</td><td>${escapeHtml(recordingFile.name)}</td></tr>
    <tr><td class="label">文件信息</td><td>${recordingFile.format.toUpperCase()} · ${formatFileSize(recordingFile.size)} · 时长 ${formatTimeHMS(totalDuration || recordingFile.duration)}</td></tr>
    <tr><td class="label">转写条数</td><td>共 ${segments.length} 条发言，其中需人工复听 ${segments.filter(s => s.needsReview).length} 条，重叠发言 ${segments.filter(s => s.isOverlapping).length} 条</td></tr>
  </table>

  <div class="cover-bottom">
    <p>本文档为原始录音转写记录，仅作为案件参考材料使用</p>
    <p style="margin-top: 2mm;">导出时间：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}</p>
    <p style="margin-top: 2mm; font-weight: bold; letter-spacing: 2px;">会议取证转写工具 v1.0</p>
  </div>

  <div class="page-footer">
    <span>机密 · 仅限案件相关人员查阅</span>
    <span>第 1 页 / 共 ${totalPages} 页</span>
  </div>
</div>

<div class="page">
  <div class="page-header">
    <span>${escapeHtml(caseInfo.caseNumber)} ${escapeHtml(caseInfo.caseName)}</span>
    <span>音频索引</span>
  </div>

  <div class="section-title">音 频 索 引</div>

  <div style="font-size: 12px; margin-bottom: 4mm; line-height: 1.8;">
    <strong>说明：</strong>下表列出全部发言片段的时间码及对应页码，点击编号可跳转至对应转写内容。
    标注"重叠"的发言可能存在多人同时说话的情况，建议人工复听核对。
    标注"复听"的发言已由审阅人标记为需进一步确认。
  </div>

  <table class="index-table">
    <thead>
      <tr>
        <th style="width:12mm">序号</th>
        <th style="width:22mm">发言人</th>
        <th style="width:30mm">时间码</th>
        <th>内容摘要</th>
        <th style="width:18mm">标记</th>
        <th style="width:12mm">页码</th>
      </tr>
    </thead>
    <tbody>
      ${segments.map((seg, idx) => {
        const speaker = speakers.find(s => s.id === seg.speakerId)
        const pageNum = paginated.findIndex(p => p.includes(seg)) + 2
        const tags = []
        if (seg.isOverlapping) tags.push('重叠')
        if (seg.needsReview) tags.push('复听')
        if (seg.noteType) tags.push(NOTE_TYPE_LABELS[seg.noteType])
        const summary = seg.text.length > 28 ? seg.text.substring(0, 28) + '…' : seg.text
        return `
        <tr>
          <td class="num">${idx + 1}</td>
          <td class="speaker">${escapeHtml(speaker?.name || '未知')}</td>
          <td class="time">${formatTime(seg.startTime)}</td>
          <td>${escapeHtml(summary)}</td>
          <td style="text-align:center; font-size:11px; color:#b91c1c;">${tags.join('、')}</td>
          <td class="page">${pageNum}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>

  <div class="page-footer">
    <span>音频索引</span>
    <span>第 2 页 / 共 ${totalPages} 页</span>
  </div>
</div>

${paginated.map((pageSegs, pageIdx) => {
  const actualPage = pageIdx + 3
  const segOffset = segments.indexOf(pageSegs[0])
  return `
<div class="page">
  <div class="page-header">
    <span>${escapeHtml(caseInfo.caseNumber)} ${escapeHtml(caseInfo.caseName)}</span>
    <span>转写正文 · 第${pageIdx + 1}部分</span>
  </div>

  <div class="section-title">转 写 正 文</div>

  <div class="note-key">
    ■关键承诺 &nbsp; ■事实陈述 &nbsp; ■存在争议<br>
    ■重要提醒 &nbsp; ■备注信息 &nbsp; ■重叠/复听
  </div>

  ${pageSegs.map(seg => {
    const speaker = speakers.find(s => s.id === seg.speakerId)
    const seqNum = segOffset + pageSegs.indexOf(seg) + 1
    const tags = []
    if (seg.isOverlapping) tags.push('<span class="seg-tag overlap">重叠发言</span>')
    if (seg.needsReview) tags.push('<span class="seg-tag review">需人工复听</span>')
    return `
    <div class="seg-item" id="seg-${seg.id}">
      <div class="seg-header">
        <span class="seg-num">${seqNum}</span>
        <span class="seg-speaker">${escapeHtml(speaker?.name || '未知发言人')}</span>
        ${speaker ? `<span class="seg-role">${SPEAKER_ROLE_LABELS[speaker.role]}</span>` : ''}
        <span class="seg-time">[${formatTime(seg.startTime)} - ${formatTime(seg.endTime)}]</span>
        ${tags.join('')}
      </div>
      <div class="seg-text" style="${seg.needsReview ? 'color:#991b1b;' : ''}">${escapeHtml(seg.text)}</div>
      ${seg.note ? `
      <div class="seg-note ${seg.noteType || 'info'}">
        <div class="seg-note-label">【${seg.noteType ? NOTE_TYPE_LABELS[seg.noteType] : '备注'}】</div>
        <div>${escapeHtml(seg.note)}</div>
      </div>` : ''}
    </div>`
  }).join('')}

  <div class="page-footer">
    <span>转写正文</span>
    <span>第 ${actualPage} 页 / 共 ${totalPages} 页</span>
  </div>
</div>`
}).join('')}

<div class="page">
  <div class="page-header">
    <span>${escapeHtml(caseInfo.caseNumber)} ${escapeHtml(caseInfo.caseName)}</span>
    <span>签名确认页</span>
  </div>

  <div class="section-title">签 名 确 认</div>

  <div style="font-size: 13px; line-height: 2; margin-bottom: 8mm; text-indent: 2em;">
    本会议记录共 <strong>${totalPages}</strong> 页，依据原始录音逐字转写，审阅人已对标记内容进行核对。
    本人确认已完整阅读上述转写内容，并确认本人发言部分记录准确无误。
    如有异议，请于收到本记录之日起三个工作日内以书面形式提出。
  </div>

  <div class="sign-section">
    ${speakers.map(s => `
    <div class="sign-row">
      <div class="sign-label">${escapeHtml(s.name)}（${SPEAKER_ROLE_LABELS[s.role]}）签名：</div>
      <div class="sign-line">
        <span class="hint">（请在此处手写签名）</span>
      </div>
      <div class="sign-date">日期：________年____月____日</div>
    </div>`).join('')}

    <div class="sign-row" style="margin-top: 10mm;">
      <div class="sign-label">审阅律师签名：</div>
      <div class="sign-line">
        <span class="hint">（请在此处手写签名）</span>
      </div>
      <div class="sign-date">日期：________年____月____日</div>
    </div>

    <div class="sign-row" style="margin-top: 10mm;">
      <div class="sign-label">归档确认：</div>
      <div class="sign-line">
        <span class="hint">（档案管理人员签名）</span>
      </div>
      <div class="sign-date">日期：________年____月____日 &nbsp;&nbsp;&nbsp; 档案编号：________________</div>
    </div>
  </div>

  <div style="position:absolute; bottom:30mm; left:22mm; right:22mm; font-size:11px; color:#999; text-align:center; line-height:1.8;">
    ──────────────────────────────────────<br>
    本记录由「会议取证转写工具」自动生成，原始录音文件请参照附件归档。<br>
    如需核对原始音频，请使用本工具打开对应项目文件进行回放验证。
  </div>

  <div class="page-footer">
    <span>签名确认</span>
    <span>第 ${totalPages} 页 / 共 ${totalPages} 页</span>
  </div>
</div>

<!-- JSON_DATA_PLACEHOLDER -->

</body>
</html>`
}

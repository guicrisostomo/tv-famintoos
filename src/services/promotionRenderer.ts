import type { PromotionDesign, PromotionProduct } from '../domain/promotion'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
async function loadImage(url: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => resolve(image); image.onerror = () => reject(new Error('Não foi possível carregar uma imagem do produto.')); image.src = url }) }
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.clip() }

export async function renderPromotion(canvas: HTMLCanvasElement, title: string, subtitle: string, products: PromotionProduct[], design: PromotionDesign) {
  const [width, height] = design.resolution.split('x').map(Number); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas indisponível.')
  if (design.gradient) { const gradient = ctx.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, design.backgroundColor); gradient.addColorStop(1, '#071a13'); ctx.fillStyle = gradient } else ctx.fillStyle = design.backgroundColor
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = `${design.highlightColor}22`; ctx.beginPath(); ctx.arc(width * .08, height * .12, width * .16, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(width * .92, height * .84, width * .21, 0, Math.PI * 2); ctx.fill()
  ctx.textAlign = design.alignment; ctx.textBaseline = 'middle'; ctx.font = `900 ${Math.round(width * .048)}px ${design.fontFamily}`; ctx.fillStyle = design.textColor
  ctx.fillText(title || 'Sua promoção', design.alignment === 'center' ? width / 2 : width * .06, height * .085, width * .88)
  ctx.font = `600 ${Math.round(width * .019)}px ${design.fontFamily}`; if (subtitle) ctx.fillText(subtitle, design.alignment === 'center' ? width / 2 : width * .06, height * .148, width * .88)
  const count = Math.max(1, Math.min(3, products.length)); const gap = width * .025; const widthRatio = count === 1 ? .52 : count === 2 ? .39 : .285; const cardWidth = width * widthRatio; const groupWidth = cardWidth * count + gap * (count - 1); const startX = (width - groupWidth) / 2; const cardY = height * .205; const cardHeight = height * .69
  for (let index = 0; index < count; index += 1) {
    const product = products[index]; const x = startX + index * (cardWidth + gap); ctx.save(); if (design.shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12 }; ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.beginPath(); ctx.roundRect(x, cardY, cardWidth, cardHeight, design.borderRadius); ctx.fill(); ctx.restore()
    const imageHeight = cardHeight * .52
    if (product.image_url) { const image = await loadImage(product.image_url); ctx.save(); rounded(ctx, x, cardY, cardWidth, imageHeight, design.borderRadius); const scale = Math.max(cardWidth / image.width, imageHeight / image.height) * product.image_transform.scale; const iw = image.width * scale; const ih = image.height * scale; ctx.drawImage(image, x + (cardWidth - iw) / 2 + product.image_transform.x, cardY + (imageHeight - ih) / 2 + product.image_transform.y, iw, ih); ctx.restore() }
    ctx.textAlign = 'center'; ctx.fillStyle = '#183228'; ctx.font = `800 ${Math.round(width * (count === 1 ? .031 : .022))}px ${design.fontFamily}`; ctx.fillText(product.name || 'Produto', x + cardWidth / 2, cardY + cardHeight * .62, cardWidth * .86)
    ctx.font = `500 ${Math.round(width * (count === 3 ? .013 : .015))}px ${design.fontFamily}`; if (product.short_description) ctx.fillText(product.short_description, x + cardWidth / 2, cardY + cardHeight * .69, cardWidth * .86)
    if (product.original_price) { ctx.fillStyle = '#77837d'; ctx.font = `400 ${Math.round(width * .016)}px ${design.fontFamily}`; ctx.fillText(`De ${money.format(product.original_price)}`, x + cardWidth / 2, cardY + cardHeight * .77); const measured = ctx.measureText(`De ${money.format(product.original_price)}`); ctx.fillRect(x + cardWidth / 2 - measured.width / 2, cardY + cardHeight * .77, measured.width, 2) }
    ctx.fillStyle = design.priceColor; ctx.font = `900 ${Math.round(width * (count === 1 ? .05 : count === 2 ? .039 : .031))}px ${design.fontFamily}`; ctx.fillText(money.format(product.promotional_price || 0), x + cardWidth / 2, cardY + cardHeight * .87, cardWidth * .9)
    if (product.badge_text || design.sealText) { ctx.fillStyle = design.highlightColor; ctx.beginPath(); ctx.roundRect(x + cardWidth * .08, cardY + imageHeight - 25, cardWidth * .45, 50, 25); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(width * .012)}px ${design.fontFamily}`; ctx.fillText(product.badge_text || design.sealText, x + cardWidth * .305, cardY + imageHeight) }
  }
  ctx.textAlign = 'center'; ctx.fillStyle = design.textColor; ctx.font = `500 ${Math.round(width * .014)}px ${design.fontFamily}`; ctx.fillText([design.additionalText, design.instagram, design.whatsapp].filter(Boolean).join('  •  '), width / 2, height * .95)
}

export function promotionBlob(canvas: HTMLCanvasElement) { return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao gerar a arte.')), 'image/webp', .9)) }

import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const isDev = process.env.NODE_ENV !== 'production'

// In dev, process.cwd() = project root (where prisma db push ran).
// In prod, store DB in user data directory.
const dbPath = isDev
  ? path.join(process.cwd(), 'prisma', 'restaurant.db')
  : path.join(app.getPath('userData'), 'restaurant.db')

// Must use forward slashes for a valid SQLite file URL on Windows
const dbUrl = 'file:' + dbPath.replace(/\\/g, '/')

// Set before PrismaClient instantiates so it reads the correct URL
process.env.DATABASE_URL = dbUrl
console.log('[DB]', dbUrl)

const prisma = new PrismaClient()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#f1f5f9',
    title: 'نظام إدارة المطعم',
  })

  if (isDev) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL'] || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())
}

async function ensureSystemRole() {
  // Create system admin role if it doesn't exist
  let sysRole = await prisma.role.findFirst({ where: { isSystem: true } })
  if (!sysRole) {
    sysRole = await prisma.role.create({
      data: { name: 'مدير النظام', fullAccess: true, permissions: '[]', isSystem: true },
    })
  }

  // Migrate users whose role name no longer exists in the roles table
  const knownNames = (await prisma.role.findMany({ select: { name: true } })).map(r => r.name)
  await prisma.user.updateMany({
    where: { role: { notIn: knownNames } },
    data:  { role: sysRole.name },
  })
}

async function resolveRole(roleName: string) {
  const r = await prisma.role.findUnique({ where: { name: roleName } })
  if (!r) return null
  return { ...r, permissions: JSON.parse(r.permissions || '[]') as string[] }
}

async function checkAutoBackup() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['autoBackupEnabled', 'autoBackupPath', 'autoBackupInterval', 'autoBackupLastRun'] } },
  })
  const cfg: Record<string, string> = {}
  rows.forEach(r => { cfg[r.key] = r.value })

  if (cfg.autoBackupEnabled !== 'true' || !cfg.autoBackupPath) return

  const now = new Date()
  const lastRun = cfg.autoBackupLastRun ? new Date(cfg.autoBackupLastRun) : null
  if (lastRun) {
    const hoursSince = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60)
    const needed = cfg.autoBackupInterval === 'weekly' ? 168 : 24
    if (hoursSince < needed) return
  }

  try {
    const { copyFile, mkdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    if (!existsSync(cfg.autoBackupPath)) await mkdir(cfg.autoBackupPath, { recursive: true })
    const stamp = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    const dest  = path.join(cfg.autoBackupPath, `restaurant-backup-${stamp}.db`)
    await copyFile(dbPath, dest)
    await prisma.setting.upsert({
      where:  { key: 'autoBackupLastRun' },
      update: { value: now.toISOString() },
      create: { key: 'autoBackupLastRun', value: now.toISOString() },
    })
    console.log('[AutoBackup] Created:', dest)
  } catch (err) {
    console.error('[AutoBackup] Failed:', err)
  }
}

app.whenReady().then(async () => {
  await ensureSystemRole()
  await checkAutoBackup()
  createWindow()
  setupIpcHandlers()
  setInterval(checkAutoBackup, 60 * 60 * 1000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    prisma.$disconnect()
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

function setupIpcHandlers() {
  // ─── INGREDIENTS ───────────────────────────────────────────────
  ipcMain.handle('ingredients:getAll', (_, includeArchived = false) =>
    prisma.ingredient.findMany({
      where: includeArchived ? undefined : { isArchived: false },
      orderBy: { name: 'asc' },
    })
  )

  ipcMain.handle('ingredients:getCategories', async () => {
    const rows = await prisma.ingredient.findMany({
      where: { isArchived: false, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    })
    return rows.map(r => r.category).filter(Boolean) as string[]
  })

  async function nextSku() {
    const last = await prisma.ingredient.findFirst({
      where: { sku: { not: null } },
      orderBy: { sku: 'desc' },
    })
    if (!last?.sku) return 'SK-0001'
    const num = parseInt(last.sku.replace('SK-', '')) + 1
    return `SK-${String(num).padStart(4, '0')}`
  }

  ipcMain.handle('ingredients:create', async (_, data) => {
    const sku = data.sku || await nextSku()
    return prisma.ingredient.create({ data: { ...data, sku } })
  })

  ipcMain.handle('ingredients:update', (_, { id, ...data }) =>
    prisma.ingredient.update({ where: { id }, data })
  )

  ipcMain.handle('ingredients:archive', (_, id: number) =>
    prisma.ingredient.update({ where: { id }, data: { isArchived: true } })
  )

  ipcMain.handle('ingredients:restore', (_, id: number) =>
    prisma.ingredient.update({ where: { id }, data: { isArchived: false } })
  )

  ipcMain.handle('ingredients:getPriceHistory', (_, ingredientId: number) =>
    prisma.priceHistory.findMany({
      where: { ingredientId },
      orderBy: { date: 'asc' },
      take: 100,
    })
  )

  // ─── PRODUCTS ──────────────────────────────────────────────────
  ipcMain.handle('products:getAll', () =>
    prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { recipes: { include: { ingredient: true } } },
    })
  )

  ipcMain.handle('products:create', (_, data) =>
    prisma.product.create({ data })
  )

  ipcMain.handle('products:update', (_, { id, ...data }) =>
    prisma.product.update({ where: { id }, data })
  )

  ipcMain.handle('products:delete', (_, id: number) =>
    prisma.product.delete({ where: { id } })
  )

  ipcMain.handle('products:selectImage', async (_, productId: number) => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: 'اختر صورة الوجبة',
      filters: [{ name: 'الصور', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const src = result.filePaths[0]
    const { copyFile, mkdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    const dir = path.join(app.getPath('userData'), 'product-images')
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
    const ext  = path.extname(src)
    const dest = path.join(dir, `product-${productId}-${Date.now()}${ext}`)
    await copyFile(src, dest)
    await prisma.product.update({ where: { id: productId }, data: { imagePath: dest } })
    return dest
  })

  ipcMain.handle('products:removeImage', async (_, productId: number) => {
    const prod = await prisma.product.findUnique({ where: { id: productId }, select: { imagePath: true } })
    if (prod?.imagePath) {
      try {
        const { unlink } = await import('node:fs/promises')
        const { existsSync } = await import('node:fs')
        if (existsSync(prod.imagePath)) await unlink(prod.imagePath)
      } catch {}
    }
    return prisma.product.update({ where: { id: productId }, data: { imagePath: null } })
  })

  ipcMain.handle('products:getImageData', async (_, imagePath: string) => {
    if (!imagePath) return null
    try {
      const { readFile } = await import('node:fs/promises')
      const { existsSync } = await import('node:fs')
      if (!existsSync(imagePath)) return null
      const buf  = await readFile(imagePath)
      const ext  = path.extname(imagePath).toLowerCase().slice(1)
      const mime = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string,string>)[ext] ?? 'image/jpeg'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch { return null }
  })

  // ─── RECIPES ───────────────────────────────────────────────────
  ipcMain.handle('recipes:setForProduct', async (_, { productId, items }: {
    productId: number
    items: { ingredientId: number; quantity: number }[]
  }) => {
    await prisma.recipe.deleteMany({ where: { productId } })
    if (items.length > 0) {
      await prisma.recipe.createMany({
        data: items.map(item => ({ ...item, productId })),
      })
    }
    return prisma.recipe.findMany({
      where: { productId },
      include: { ingredient: true },
    })
  })

  // ─── TABLES ────────────────────────────────────────────────────
  ipcMain.handle('tables:getAll', () =>
    prisma.table.findMany({ orderBy: { number: 'asc' } })
  )

  ipcMain.handle('tables:create', (_, data: { number: string; capacity: number; zone?: string; note?: string }) =>
    prisma.table.create({ data: { ...data, zone: data.zone || null, note: data.note || null } })
  )

  ipcMain.handle('tables:update', (_, { id, ...data }: any) =>
    prisma.table.update({ where: { id }, data })
  )

  ipcMain.handle('tables:updateStatus', (_, { id, status }: { id: number; status: string }) =>
    prisma.table.update({ where: { id }, data: { status } })
  )

  ipcMain.handle('tables:delete', (_, id: number) =>
    prisma.table.delete({ where: { id } })
  )

  // ─── PROMOTIONS ────────────────────────────────────────────────
  function includePromotion() {
    return { products: { include: { product: true } } } as const
  }

  ipcMain.handle('promotions:getAll', () =>
    prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
      include: includePromotion(),
    })
  )

  ipcMain.handle('promotions:create', async (_, {
    name, discountType, discountValue, startDate, endDate, isActive, applyToAll, productIds,
  }: {
    name: string; discountType: string; discountValue: number
    startDate: string; endDate: string; isActive: boolean; applyToAll: boolean
    productIds: number[]
  }) =>
    prisma.promotion.create({
      data: {
        name, discountType, discountValue, isActive, applyToAll,
        startDate: new Date(startDate),
        endDate:   new Date(endDate),
        products:  applyToAll ? undefined : { create: productIds.map(pid => ({ productId: pid })) },
      },
      include: includePromotion(),
    })
  )

  ipcMain.handle('promotions:update', async (_, {
    id, name, discountType, discountValue, startDate, endDate, isActive, applyToAll, productIds,
  }: any) => {
    await prisma.promotionProduct.deleteMany({ where: { promotionId: id } })
    return prisma.promotion.update({
      where: { id },
      data: {
        name, discountType, discountValue, isActive, applyToAll,
        startDate: new Date(startDate),
        endDate:   new Date(endDate),
        products:  applyToAll ? undefined : { create: (productIds as number[]).map(pid => ({ productId: pid })) },
      },
      include: includePromotion(),
    })
  })

  ipcMain.handle('promotions:toggle', async (_, id: number) => {
    const p = await prisma.promotion.findUnique({ where: { id } })
    return prisma.promotion.update({
      where: { id },
      data: { isActive: !p?.isActive },
      include: includePromotion(),
    })
  })

  ipcMain.handle('promotions:delete', (_, id: number) =>
    prisma.promotion.delete({ where: { id } })
  )

  // ─── SUPPLIERS ─────────────────────────────────────────────────
  ipcMain.handle('suppliers:getAll', () =>
    prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  )

  ipcMain.handle('suppliers:create', (_, data) =>
    prisma.supplier.create({ data })
  )

  ipcMain.handle('suppliers:update', (_, { id, ...data }) =>
    prisma.supplier.update({ where: { id }, data })
  )

  ipcMain.handle('suppliers:delete', (_, id: number) =>
    prisma.supplier.delete({ where: { id } })
  )

  // ─── PURCHASE INVOICES ─────────────────────────────────────────
  ipcMain.handle('invoices:getAll', () =>
    prisma.purchaseInvoice.findMany({
      where: { status: 'confirmed' },
      orderBy: { invoiceDate: 'desc' },
      include: { supplier: true, items: { include: { ingredient: true } } },
    })
  )

  ipcMain.handle('invoices:getDrafts', () =>
    prisma.purchaseInvoice.findMany({
      where: { status: 'draft' },
      orderBy: { createdAt: 'desc' },
      include: { supplier: true, items: { include: { ingredient: true } } },
    })
  )

  // Shared helper: apply stock changes for a confirmed invoice
  // item.quantity is in storageUnit; we convert to usageUnit via conversionFactor
  async function applyInvoiceStock(invoiceId: number, items: any[], label: string) {
    for (const item of items) {
      const ing = await prisma.ingredient.findUnique({ where: { id: item.ingredientId } })
      const factor       = ing?.conversionFactor ?? 1
      const stockIncrease = item.quantity * factor
      const costPerUnit   = factor > 0 ? item.unitPrice / factor : item.unitPrice

      const prevIng = await prisma.ingredient.findUnique({ where: { id: item.ingredientId }, select: { costPerUnit: true } })
      await prisma.ingredient.update({
        where: { id: item.ingredientId },
        data: {
          currentStock: { increment: stockIncrease },
          costPerUnit,
        },
      })
      await prisma.stockMovement.create({
        data: {
          ingredientId: item.ingredientId,
          quantity:     stockIncrease,
          type:         'purchase',
          referenceId:  invoiceId,
          note:         `فاتورة شراء ${label}`,
        },
      })
      if (!prevIng || prevIng.costPerUnit !== costPerUnit) {
        await prisma.priceHistory.create({
          data: { ingredientId: item.ingredientId, price: costPerUnit, note: `فاتورة شراء ${label}` },
        })
      }
    }
  }

  ipcMain.handle('invoices:create', async (_, { items, ...invoiceData }) => {
    const invoice = await prisma.purchaseInvoice.create({
      data: {
        ...invoiceData,
        status: 'confirmed',
        invoiceDate: new Date(invoiceData.invoiceDate),
        items: { create: items },
      },
    })
    await applyInvoiceStock(invoice.id, items, invoiceData.invoiceNumber || '#' + invoice.id)
    return prisma.purchaseInvoice.findUnique({
      where: { id: invoice.id },
      include: { supplier: true, items: { include: { ingredient: true } } },
    })
  })

  // Save new invoice as draft — no stock change
  ipcMain.handle('invoices:saveDraft', async (_, { items, ...invoiceData }) =>
    prisma.purchaseInvoice.create({
      data: {
        ...invoiceData,
        status: 'draft',
        invoiceDate: new Date(invoiceData.invoiceDate),
        items: { create: items },
      },
      include: { supplier: true, items: { include: { ingredient: true } } },
    })
  )

  // Update an existing draft (replaces items)
  ipcMain.handle('invoices:updateDraft', async (_, { id, items, ...invoiceData }) => {
    const existing = await prisma.purchaseInvoice.findUnique({ where: { id } })
    if (!existing || existing.status !== 'draft') throw new Error('Invoice is not a draft')
    await prisma.purchaseItem.deleteMany({ where: { invoiceId: id } })
    return prisma.purchaseInvoice.update({
      where: { id },
      data: {
        ...invoiceData,
        invoiceDate: new Date(invoiceData.invoiceDate),
        items: { create: items },
      },
      include: { supplier: true, items: { include: { ingredient: true } } },
    })
  })

  // Delete a draft invoice
  ipcMain.handle('invoices:deleteDraft', async (_, id: number) => {
    const existing = await prisma.purchaseInvoice.findUnique({ where: { id } })
    if (!existing || existing.status !== 'draft') throw new Error('Invoice is not a draft')
    return prisma.purchaseInvoice.delete({ where: { id } })
  })

  // Confirm a draft → apply stock
  ipcMain.handle('invoices:confirmDraft', async (_, id: number) => {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!invoice || invoice.status === 'confirmed') return

    await prisma.purchaseInvoice.update({ where: { id }, data: { status: 'confirmed' } })
    await applyInvoiceStock(id, invoice.items, invoice.invoiceNumber || '#' + id)

    return prisma.purchaseInvoice.findUnique({
      where: { id },
      include: { supplier: true, items: { include: { ingredient: true } } },
    })
  })

  // ─── SALES ─────────────────────────────────────────────────────
  ipcMain.handle('sales:getAll', () =>
    prisma.sale.findMany({
      where: { status: 'confirmed' },
      orderBy: { saleDate: 'desc' },
      include: { product: true, customer: true },
      take: 500,
    })
  )

  // Shared helper: create confirmed sale rows + deduct stock
  async function createConfirmedSales(salesData: any[], source: string) {
    const results = []
    for (const saleData of salesData) {
      const product = await prisma.product.findUnique({
        where: { id: saleData.productId },
        include: { recipes: true },
      })
      if (!product) continue

      const sale = await prisma.sale.create({
        data: {
          productId: saleData.productId,
          customerId: saleData.customerId ?? null,
          quantity: saleData.quantity,
          unitPrice: saleData.unitPrice,
          total: saleData.total,
          note: saleData.note ?? null,
          source,
          status: 'confirmed',
          saleDate: saleData.saleDate ? new Date(saleData.saleDate) : new Date(),
        },
      })
      results.push(sale)

      for (const recipe of product.recipes) {
        const consumed = recipe.quantity * saleData.quantity
        await prisma.ingredient.update({
          where: { id: recipe.ingredientId },
          data: { currentStock: { decrement: consumed } },
        })
        await prisma.stockMovement.create({
          data: {
            ingredientId: recipe.ingredientId,
            quantity: -consumed,
            type: 'sale',
            referenceId: sale.id,
            note: `بيع ${saleData.quantity} × ${product.name}`,
          },
        })
      }
    }
    return results
  }

  ipcMain.handle('sales:create', (_, salesData: any[]) =>
    createConfirmedSales(salesData, 'manual')
  )

  // Save as draft — no stock deduction
  ipcMain.handle('sales:saveDraft', async (_, salesData: any[]) => {
    const results = []
    for (const d of salesData) {
      const sale = await prisma.sale.create({
        data: {
          productId: d.productId,
          customerId: d.customerId ?? null,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          total: d.total,
          note: d.note ?? null,
          source: 'manual',
          status: 'draft',
          saleDate: d.saleDate ? new Date(d.saleDate) : new Date(),
        },
        include: { product: true, customer: true },
      })
      results.push(sale)
    }
    return results
  })

  ipcMain.handle('sales:getDrafts', () =>
    prisma.sale.findMany({
      where: { status: 'draft' },
      orderBy: { saleDate: 'desc' },
      include: { product: true, customer: true },
    })
  )

  ipcMain.handle('sales:updateDraft', async (_, { id, ...data }: any) =>
    prisma.sale.update({
      where: { id, status: 'draft' },
      data: {
        customerId: data.customerId ?? null,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        total: data.quantity * data.unitPrice,
        note: data.note ?? null,
        saleDate: data.saleDate ? new Date(data.saleDate) : undefined,
      },
      include: { product: true, customer: true },
    })
  )

  ipcMain.handle('sales:deleteDraft', (_, id: number) =>
    prisma.sale.delete({ where: { id, status: 'draft' } })
  )

  // Confirm one or more drafts → trigger stock deduction
  ipcMain.handle('sales:confirmDrafts', async (_, ids: number[]) => {
    for (const id of ids) {
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: { product: { include: { recipes: true } } },
      })
      if (!sale || sale.status === 'confirmed') continue

      await prisma.sale.update({ where: { id }, data: { status: 'confirmed' } })

      for (const recipe of sale.product.recipes) {
        const consumed = recipe.quantity * sale.quantity
        await prisma.ingredient.update({
          where: { id: recipe.ingredientId },
          data: { currentStock: { decrement: consumed } },
        })
        await prisma.stockMovement.create({
          data: {
            ingredientId: recipe.ingredientId,
            quantity: -consumed,
            type: 'sale',
            referenceId: sale.id,
            note: `بيع ${sale.quantity} × ${sale.product.name}`,
          },
        })
      }
    }
    return ids
  })

  // Import from Excel (rows pre-parsed in renderer)
  ipcMain.handle('sales:importConfirm', (_, salesData: any[]) =>
    createConfirmedSales(salesData, 'excel')
  )

  // ─── OVERHEAD / COST CENTERS ───────────────────────────────────
  ipcMain.handle('overhead:getAll', () =>
    prisma.overheadEntry.findMany({ orderBy: [{ type: 'asc' }, { category: 'asc' }, { name: 'asc' }] })
  )
  ipcMain.handle('overhead:create', (_, data: any) =>
    prisma.overheadEntry.create({ data: {
      name:     data.name,
      category: data.category,
      type:     data.type,
      amount:   data.amount,
      note:     data.note ?? null,
    }})
  )
  ipcMain.handle('overhead:update', (_, data: any) =>
    prisma.overheadEntry.update({
      where: { id: data.id },
      data:  { name: data.name, category: data.category, type: data.type, amount: data.amount, note: data.note ?? null },
    })
  )
  ipcMain.handle('overhead:toggle', async (_, id: number) => {
    const e = await prisma.overheadEntry.findUnique({ where: { id } })
    return prisma.overheadEntry.update({ where: { id }, data: { isActive: !e?.isActive } })
  })
  ipcMain.handle('overhead:delete', (_, id: number) =>
    prisma.overheadEntry.delete({ where: { id } })
  )

  // ─── DELIVERY PARTNERS ─────────────────────────────────────────
  ipcMain.handle('delivery:getAll', () =>
    prisma.deliveryPartner.findMany({ orderBy: { name: 'asc' }, include: { prices: true } })
  )
  ipcMain.handle('delivery:create', (_, data: any) =>
    prisma.deliveryPartner.create({
      data: {
        name:           data.name,
        commissionType: data.commissionType ?? 'percentage',
        commission:     data.commission ?? 0,
        contractStart:  data.contractStart || null,
        contractEnd:    data.contractEnd   || null,
        contractNotes:  data.contractNotes || null,
        isActive:       data.isActive ?? true,
      },
      include: { prices: true },
    })
  )
  ipcMain.handle('delivery:update', (_, { id, ...data }: any) =>
    prisma.deliveryPartner.update({
      where: { id },
      data: {
        name:           data.name,
        commissionType: data.commissionType,
        commission:     data.commission,
        contractStart:  data.contractStart || null,
        contractEnd:    data.contractEnd   || null,
        contractNotes:  data.contractNotes || null,
        isActive:       data.isActive,
      },
      include: { prices: true },
    })
  )
  ipcMain.handle('delivery:toggle', async (_, id: number) => {
    const p = await prisma.deliveryPartner.findUnique({ where: { id } })
    return prisma.deliveryPartner.update({
      where: { id },
      data:  { isActive: !p?.isActive },
      include: { prices: true },
    })
  })
  ipcMain.handle('delivery:delete', (_, id: number) =>
    prisma.deliveryPartner.delete({ where: { id } })
  )
  ipcMain.handle('delivery:getPrices', (_, partnerId: number) =>
    prisma.deliveryProductPrice.findMany({ where: { partnerId } })
  )
  ipcMain.handle('delivery:setPrice', async (_, { partnerId, productId, price }: any) =>
    prisma.deliveryProductPrice.upsert({
      where:  { partnerId_productId: { partnerId, productId } },
      update: { price },
      create: { partnerId, productId, price },
    })
  )
  ipcMain.handle('delivery:removePrice', async (_, { partnerId, productId }: any) => {
    await prisma.deliveryProductPrice.deleteMany({ where: { partnerId, productId } })
  })

  // ─── POS ───────────────────────────────────────────────────────
  ipcMain.handle('pos:createOrder', async (_, payload: any) => {
    const count = await prisma.posOrder.count()
    const orderNumber = `POS-${String(count + 1).padStart(5, '0')}`

    const order = await prisma.posOrder.create({
      data: {
        orderNumber,
        orderType:         payload.orderType ?? 'dine_in',
        tableId:           payload.tableId ?? null,
        customerId:        payload.customerId ?? null,
        deliveryPartnerId: payload.deliveryPartnerId ?? null,
        commissionAmount:  payload.commissionAmount ?? 0,
        paymentMethod:     payload.paymentMethod ?? 'cash',
        subtotal:          payload.subtotal,
        discountType:      payload.discountType ?? null,
        discountValue:     payload.discountValue ?? 0,
        discountAmount:    payload.discountAmount ?? 0,
        total:             payload.total,
        note:              payload.note ?? null,
        status:            'completed',
        items: {
          create: payload.items.map((item: any) => ({
            productId:   item.productId,
            productName: item.productName,
            quantity:    item.quantity,
            unitPrice:   item.unitPrice,
            total:       item.total,
          })),
        },
      },
      include: { items: true, customer: true },
    })

    // Create sale records + deduct stock
    await createConfirmedSales(
      payload.items.map((item: any) => ({
        productId: item.productId,
        customerId: payload.customerId ?? null,
        quantity:  item.quantity,
        unitPrice: item.unitPrice,
        total:     item.total,
        note:      `طلب ${orderNumber}`,
      })),
      'pos'
    )

    // Free the table if one was selected
    if (payload.tableId) {
      await prisma.table.update({
        where: { id: payload.tableId },
        data:  { status: 'available' },
      })
    }

    // Auto-accrue loyalty points (disabled by default — configure in Settings)
    if (payload.customerId) {
      const rateSetting = await prisma.setting.findUnique({ where: { key: 'loyaltyPointsPerCurrency' } })
      const rate = parseFloat(rateSetting?.value ?? '0')
      if (rate > 0) {
        const points = Math.floor(order.total / rate)
        if (points > 0) {
          await prisma.customer.update({
            where: { id: payload.customerId },
            data: { loyaltyPoints: { increment: points } },
          })
        }
      }
    }

    return order
  })

  ipcMain.handle('pos:getOrders', (_, limit = 200) =>
    prisma.posOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { items: true, customer: true },
    })
  )

  ipcMain.handle('pos:voidOrder', async (_, id: number) => {
    const order = await prisma.posOrder.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!order || order.status === 'voided') throw new Error('الطلب غير موجود أو ملغي بالفعل')

    // Restore stock for each item
    for (const item of order.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { recipes: true },
      })
      if (!product) continue
      for (const recipe of product.recipes) {
        const qty = recipe.quantity * item.quantity
        await prisma.ingredient.update({
          where: { id: recipe.ingredientId },
          data:  { currentStock: { increment: qty } },
        })
        await prisma.stockMovement.create({
          data: {
            ingredientId: recipe.ingredientId,
            quantity:     qty,
            type:         'adjust',
            referenceId:  order.id,
            note:         `إلغاء طلب ${order.orderNumber}`,
          },
        })
      }
    }

    return prisma.posOrder.update({
      where: { id },
      data:  { status: 'voided' },
      include: { items: true, customer: true },
    })
  })

  // ─── PRODUCTION ────────────────────────────────────────────────
  ipcMain.handle('production:getAll', () =>
    prisma.production.findMany({
      orderBy: { date: 'desc' },
      include: { items: { include: { ingredient: true } } },
    })
  )

  ipcMain.handle('production:create', async (_, {
    date, note,
    inputs,  // [{ ingredientId, quantity }]
    outputs, // [{ ingredientId, quantity }]
  }: {
    date: string; note?: string
    inputs:  { ingredientId: number; quantity: number }[]
    outputs: { ingredientId: number; quantity: number }[]
  }) => {
    const production = await prisma.production.create({
      data: {
        date:  new Date(date),
        note:  note ?? null,
        items: {
          create: [
            ...inputs.map(i  => ({ ingredientId: i.ingredientId,  quantity: i.quantity,  type: 'input'  })),
            ...outputs.map(o => ({ ingredientId: o.ingredientId,  quantity: o.quantity,  type: 'output' })),
          ],
        },
      },
      include: { items: { include: { ingredient: true } } },
    })

    for (const item of inputs) {
      await prisma.ingredient.update({
        where: { id: item.ingredientId },
        data:  { currentStock: { decrement: item.quantity } },
      })
      await prisma.stockMovement.create({
        data: {
          ingredientId: item.ingredientId,
          quantity:     -item.quantity,
          type:         'production',
          referenceId:  production.id,
          note:         `مدخل إنتاج #${production.id}`,
        },
      })
    }
    for (const item of outputs) {
      await prisma.ingredient.update({
        where: { id: item.ingredientId },
        data:  { currentStock: { increment: item.quantity } },
      })
      await prisma.stockMovement.create({
        data: {
          ingredientId: item.ingredientId,
          quantity:     item.quantity,
          type:         'production',
          referenceId:  production.id,
          note:         `مخرج إنتاج #${production.id}`,
        },
      })
    }

    return production
  })

  ipcMain.handle('production:delete', async (_, id: number) => {
    // Reverse stock movements before deleting
    const prod = await prisma.production.findUnique({
      where: { id },
      include: { items: true },
    })
    if (prod) {
      for (const item of prod.items) {
        const delta = item.type === 'input' ? item.quantity : -item.quantity
        await prisma.ingredient.update({
          where: { id: item.ingredientId },
          data:  { currentStock: { increment: delta } },
        })
      }
      await prisma.stockMovement.deleteMany({ where: { type: 'production', referenceId: id } })
    }
    return prisma.production.delete({ where: { id } })
  })

  // ─── PURCHASE REQUESTS ─────────────────────────────────────────
  ipcMain.handle('purchaseRequests:getAll', () =>
    prisma.purchaseRequest.findMany({
      orderBy: { requestDate: 'desc' },
      include: { supplier: true, items: { include: { ingredient: true } } },
    })
  )

  ipcMain.handle('purchaseRequests:create', async (_, { items, ...data }) =>
    prisma.purchaseRequest.create({
      data: {
        ...data,
        requestDate: new Date(data.requestDate || Date.now()),
        items: { create: items },
      },
      include: { supplier: true, items: { include: { ingredient: true } } },
    })
  )

  ipcMain.handle('purchaseRequests:updateStatus', (_, { id, status }: { id: number; status: string }) =>
    prisma.purchaseRequest.update({ where: { id }, data: { status } })
  )

  ipcMain.handle('purchaseRequests:delete', (_, id: number) =>
    prisma.purchaseRequest.delete({ where: { id } })
  )

  // ─── STOCK ─────────────────────────────────────────────────────
  ipcMain.handle('stock:getMovements', (_, ingredientId?: number) =>
    prisma.stockMovement.findMany({
      where: ingredientId ? { ingredientId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { ingredient: true },
      take: 300,
    })
  )

  ipcMain.handle('stock:adjust', async (_, { ingredientId, quantity, note }: {
    ingredientId: number; quantity: number; note?: string
  }) => {
    await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { currentStock: { increment: quantity } },
    })
    return prisma.stockMovement.create({
      data: {
        ingredientId,
        quantity,
        type: quantity >= 0 ? 'adjust' : 'waste',
        note,
      },
    })
  })

  // ─── BRANCHES ──────────────────────────────────────────────
  ipcMain.handle('branches:getAll', () =>
    prisma.branch.findMany({ orderBy: { name: 'asc' }, include: { warehouses: true } })
  )

  ipcMain.handle('branches:create', (_, { name }: { name: string }) =>
    prisma.branch.create({ data: { name }, include: { warehouses: true } })
  )

  ipcMain.handle('branches:update', (_, { id, name }: { id: number; name: string }) =>
    prisma.branch.update({ where: { id }, data: { name }, include: { warehouses: true } })
  )

  ipcMain.handle('branches:delete', async (_, id: number) => {
    const b = await prisma.branch.findUnique({ where: { id } })
    if (b?.isDefault) throw new Error('لا يمكن حذف الفرع الافتراضي')
    return prisma.branch.delete({ where: { id } })
  })

  // ─── WAREHOUSES ────────────────────────────────────────────
  async function ensureDefaultWarehouse() {
    let branch = await prisma.branch.findFirst({ where: { isDefault: true } })
    if (!branch) {
      branch = await prisma.branch.create({ data: { name: 'الفرع الرئيسي', isDefault: true } })
    }
    let warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } })
    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: { name: 'المخزن الرئيسي', branchId: branch.id, isDefault: true },
      })
      // Sync existing ingredient stocks to default warehouse
      const ingredients = await prisma.ingredient.findMany()
      for (const ing of ingredients) {
        await prisma.warehouseStock.upsert({
          where:  { warehouseId_ingredientId: { warehouseId: warehouse.id, ingredientId: ing.id } },
          update: { quantity: ing.currentStock },
          create: { warehouseId: warehouse.id, ingredientId: ing.id, quantity: ing.currentStock },
        })
      }
    }
    return warehouse
  }

  ipcMain.handle('warehouses:init', () => ensureDefaultWarehouse())

  ipcMain.handle('warehouses:getAll', () =>
    prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
      include: { branch: true, stocks: { include: { ingredient: true } } },
    })
  )

  ipcMain.handle('warehouses:create', async (_, { name, branchId }: { name: string; branchId: number }) => {
    const warehouse = await prisma.warehouse.create({ data: { name, branchId } })
    const ingredients = await prisma.ingredient.findMany({ where: { isArchived: false } })
    if (ingredients.length > 0) {
      await prisma.warehouseStock.createMany({
        data: ingredients.map(i => ({ warehouseId: warehouse.id, ingredientId: i.id, quantity: 0 })),
      })
    }
    return prisma.warehouse.findUnique({
      where: { id: warehouse.id },
      include: { branch: true, stocks: { include: { ingredient: true } } },
    })
  })

  ipcMain.handle('warehouses:update', (_, { id, name }: { id: number; name: string }) =>
    prisma.warehouse.update({ where: { id }, data: { name }, include: { branch: true } })
  )

  ipcMain.handle('warehouses:delete', async (_, id: number) => {
    const wh = await prisma.warehouse.findUnique({ where: { id } })
    if (wh?.isDefault) throw new Error('لا يمكن حذف المخزن الافتراضي')
    return prisma.warehouse.delete({ where: { id } })
  })

  ipcMain.handle('warehouses:setDefault', async (_, id: number) => {
    await prisma.warehouse.updateMany({ data: { isDefault: false } })
    return prisma.warehouse.update({ where: { id }, data: { isDefault: true } })
  })

  ipcMain.handle('warehouses:syncStock', async (_, warehouseId: number) => {
    const ingredients = await prisma.ingredient.findMany()
    for (const ing of ingredients) {
      await prisma.warehouseStock.upsert({
        where:  { warehouseId_ingredientId: { warehouseId, ingredientId: ing.id } },
        update: { quantity: ing.currentStock },
        create: { warehouseId, ingredientId: ing.id, quantity: ing.currentStock },
      })
    }
    return prisma.warehouseStock.findMany({
      where: { warehouseId },
      include: { ingredient: true },
    })
  })

  // ─── TRANSFER REQUESTS ─────────────────────────────────────
  async function nextTransferRequestRef() {
    const last = await prisma.transferRequest.findFirst({ orderBy: { id: 'desc' } })
    const num  = last ? last.id + 1 : 1
    return `TR-${String(num).padStart(6, '0')}`
  }

  ipcMain.handle('transferRequests:getAll', () =>
    prisma.transferRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        fromWarehouse: { include: { branch: true } },
        toWarehouse:   { include: { branch: true } },
        items:         { include: { ingredient: true } },
        transfer:      true,
      },
    })
  )

  ipcMain.handle('transferRequests:create', async (_, {
    fromWarehouseId, toWarehouseId, note, items,
  }: {
    fromWarehouseId: number; toWarehouseId: number; note?: string
    items: { ingredientId: number; quantity: number; notes?: string }[]
  }) => {
    const referenceNumber = await nextTransferRequestRef()
    return prisma.transferRequest.create({
      data: {
        referenceNumber, fromWarehouseId, toWarehouseId,
        note: note ?? null,
        items: { create: items.map(i => ({ ingredientId: i.ingredientId, quantity: i.quantity, notes: i.notes ?? null })) },
      },
      include: {
        fromWarehouse: { include: { branch: true } },
        toWarehouse:   { include: { branch: true } },
        items:         { include: { ingredient: true } },
      },
    })
  })

  ipcMain.handle('transferRequests:updateStatus', (_, { id, status }: { id: number; status: string }) =>
    prisma.transferRequest.update({ where: { id }, data: { status } })
  )

  ipcMain.handle('transferRequests:delete', async (_, id: number) => {
    const req = await prisma.transferRequest.findUnique({ where: { id } })
    if (req?.status === 'transferred') throw new Error('لا يمكن حذف طلب تم تنفيذه')
    return prisma.transferRequest.delete({ where: { id } })
  })

  // ─── TRANSFERS ─────────────────────────────────────────────
  async function nextTransferRef() {
    const last = await prisma.transfer.findFirst({ orderBy: { id: 'desc' } })
    const num  = last ? last.id + 1 : 1
    return `TF-${String(num).padStart(6, '0')}`
  }

  async function applyTransferStock(fromWarehouseId: number, toWarehouseId: number, items: { ingredientId: number; quantity: number }[], transferId: number, ref: string) {
    for (const item of items) {
      await prisma.warehouseStock.upsert({
        where:  { warehouseId_ingredientId: { warehouseId: fromWarehouseId, ingredientId: item.ingredientId } },
        update: { quantity: { decrement: item.quantity } },
        create: { warehouseId: fromWarehouseId, ingredientId: item.ingredientId, quantity: -item.quantity },
      })
      await prisma.warehouseStock.upsert({
        where:  { warehouseId_ingredientId: { warehouseId: toWarehouseId, ingredientId: item.ingredientId } },
        update: { quantity: { increment: item.quantity } },
        create: { warehouseId: toWarehouseId, ingredientId: item.ingredientId, quantity: item.quantity },
      })
      await prisma.stockMovement.create({
        data: {
          ingredientId: item.ingredientId,
          quantity:     0,
          type:         'adjust',
          referenceId:  transferId,
          note:         `تحويل ${ref}`,
        },
      })
    }
  }

  ipcMain.handle('transfers:getAll', () =>
    prisma.transfer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        fromWarehouse: { include: { branch: true } },
        toWarehouse:   { include: { branch: true } },
        items:         { include: { ingredient: true } },
        request:       true,
      },
    })
  )

  ipcMain.handle('transfers:execute', async (_, requestId: number) => {
    const request = await prisma.transferRequest.findUnique({
      where: { id: requestId },
      include: { items: true },
    })
    if (!request) throw new Error('الطلب غير موجود')
    if (request.status === 'transferred') throw new Error('تم تنفيذ هذا الطلب مسبقاً')

    const referenceNumber = await nextTransferRef()
    const transfer = await prisma.transfer.create({
      data: {
        referenceNumber,
        requestId,
        fromWarehouseId: request.fromWarehouseId,
        toWarehouseId:   request.toWarehouseId,
        note:            request.note,
        items:           { create: request.items.map(i => ({ ingredientId: i.ingredientId, quantity: i.quantity })) },
      },
      include: {
        fromWarehouse: { include: { branch: true } },
        toWarehouse:   { include: { branch: true } },
        items:         { include: { ingredient: true } },
      },
    })

    await applyTransferStock(request.fromWarehouseId, request.toWarehouseId, request.items, transfer.id, referenceNumber)
    await prisma.transferRequest.update({ where: { id: requestId }, data: { status: 'transferred' } })

    return transfer
  })

  ipcMain.handle('transfers:createDirect', async (_, {
    fromWarehouseId, toWarehouseId, note, items,
  }: {
    fromWarehouseId: number; toWarehouseId: number; note?: string
    items: { ingredientId: number; quantity: number }[]
  }) => {
    const referenceNumber = await nextTransferRef()
    const transfer = await prisma.transfer.create({
      data: {
        referenceNumber, fromWarehouseId, toWarehouseId,
        note: note ?? null,
        items: { create: items },
      },
      include: {
        fromWarehouse: { include: { branch: true } },
        toWarehouse:   { include: { branch: true } },
        items:         { include: { ingredient: true } },
      },
    })
    await applyTransferStock(fromWarehouseId, toWarehouseId, items, transfer.id, referenceNumber)
    return transfer
  })

  ipcMain.handle('transfers:delete', async (_, id: number) => {
    const transfer = await prisma.transfer.findUnique({ where: { id }, include: { items: true } })
    if (!transfer) return

    for (const item of transfer.items) {
      await prisma.warehouseStock.upsert({
        where:  { warehouseId_ingredientId: { warehouseId: transfer.fromWarehouseId, ingredientId: item.ingredientId } },
        update: { quantity: { increment: item.quantity } },
        create: { warehouseId: transfer.fromWarehouseId, ingredientId: item.ingredientId, quantity: item.quantity },
      })
      await prisma.warehouseStock.upsert({
        where:  { warehouseId_ingredientId: { warehouseId: transfer.toWarehouseId, ingredientId: item.ingredientId } },
        update: { quantity: { decrement: item.quantity } },
        create: { warehouseId: transfer.toWarehouseId, ingredientId: item.ingredientId, quantity: -item.quantity },
      })
    }
    if (transfer.requestId) {
      await prisma.transferRequest.update({ where: { id: transfer.requestId }, data: { status: 'approved' } })
    }
    return prisma.transfer.delete({ where: { id } })
  })

  // ─── INVENTORY COUNT (جرد المخزون) ────────────────────────
  async function nextInventoryRef() {
    const last = await prisma.inventoryCount.findFirst({ orderBy: { id: 'desc' } })
    const num  = last ? last.id + 1 : 1
    return `IC-${String(num).padStart(6, '0')}`
  }

  ipcMain.handle('inventory:getAll', () =>
    prisma.inventoryCount.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { ingredient: true } } },
    })
  )

  ipcMain.handle('inventory:create', async () => {
    const referenceNumber = await nextInventoryRef()
    return prisma.inventoryCount.create({
      data: { referenceNumber, status: 'draft' },
      include: { items: { include: { ingredient: true } } },
    })
  })

  ipcMain.handle('inventory:addItems', async (_, { countId, ingredientIds }: { countId: number; ingredientIds: number[] }) => {
    const count = await prisma.inventoryCount.findUnique({ where: { id: countId } })
    if (!count || count.status !== 'draft') throw new Error('الجرد ليس مسودة')

    const existing = await prisma.inventoryCountItem.findMany({
      where: { inventoryCountId: countId },
      select: { ingredientId: true },
    })
    const existingIds = new Set(existing.map(e => e.ingredientId))

    for (const ingredientId of ingredientIds) {
      if (existingIds.has(ingredientId)) continue
      const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } })
      if (!ing) continue
      await prisma.inventoryCountItem.create({
        data: { inventoryCountId: countId, ingredientId, systemQuantity: ing.currentStock, actualQuantity: ing.currentStock },
      })
    }

    return prisma.inventoryCount.findUnique({
      where: { id: countId },
      include: { items: { include: { ingredient: true } } },
    })
  })

  ipcMain.handle('inventory:removeItem', (_, itemId: number) =>
    prisma.inventoryCountItem.delete({ where: { id: itemId } })
  )

  ipcMain.handle('inventory:updateItem', async (_, { id, actualQuantity }: { id: number; actualQuantity: number }) =>
    prisma.inventoryCountItem.update({ where: { id }, data: { actualQuantity } })
  )

  ipcMain.handle('inventory:close', async (_, countId: number) => {
    const count = await prisma.inventoryCount.findUnique({
      where: { id: countId },
      include: { items: true },
    })
    if (!count || count.status === 'closed') throw new Error('Already closed')

    for (const item of count.items) {
      const diff = item.actualQuantity - item.systemQuantity
      if (diff === 0) continue
      await prisma.ingredient.update({
        where: { id: item.ingredientId },
        data:  { currentStock: { increment: diff } },
      })
      await prisma.stockMovement.create({
        data: {
          ingredientId: item.ingredientId,
          quantity:     diff,
          type:         'adjust',
          referenceId:  countId,
          note:         `جرد المخزون ${count.referenceNumber}`,
        },
      })
    }

    return prisma.inventoryCount.update({
      where: { id: countId },
      data:  { status: 'closed', closedAt: new Date(), workDate: new Date() },
      include: { items: { include: { ingredient: true } } },
    })
  })

  ipcMain.handle('inventory:delete', async (_, id: number) => {
    const count = await prisma.inventoryCount.findUnique({ where: { id } })
    if (count?.status === 'closed') throw new Error('Cannot delete a closed count')
    return prisma.inventoryCount.delete({ where: { id } })
  })

  // ─── REPORTS ───────────────────────────────────────────────────
  ipcMain.handle('reports:dashboard', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000)

    const [
      ingredientCount, productCount, allIngredients,
      recentSales, todaySales,
      posToday, recentPosOrders,
      reservationsToday, pendingReservations, customerCount,
    ] = await Promise.all([
      prisma.ingredient.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.ingredient.findMany(),
      prisma.sale.findMany({
        where: { status: 'confirmed' },
        take: 10,
        orderBy: { saleDate: 'desc' },
        include: { product: true },
      }),
      prisma.sale.aggregate({
        where: { saleDate: { gte: today }, status: 'confirmed' },
        _sum: { total: true },
        _count: true,
      }),
      prisma.posOrder.aggregate({
        where: { createdAt: { gte: today, lt: todayEnd }, status: 'completed' },
        _sum: { total: true },
        _count: true,
      }),
      prisma.posOrder.findMany({
        where: { status: 'completed' },
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      prisma.reservation.count({
        where: {
          reservationDate: { gte: today, lt: todayEnd },
          status: { not: 'cancelled' },
        },
      }),
      prisma.reservation.count({
        where: { status: { in: ['pending', 'confirmed'] } },
      }),
      prisma.customer.count({ where: { isActive: true } }),
    ])

    const lowStockItems = allIngredients.filter(i => i.currentStock <= i.minStockAlert)

    return {
      ingredientCount,
      productCount,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      recentSales,
      totalSalesToday:  todaySales._sum.total ?? 0,
      salesTodayCount:  todaySales._count,
      posRevToday:      posToday._sum.total ?? 0,
      posOrdersToday:   posToday._count,
      recentPosOrders,
      reservationsToday,
      pendingReservations,
      customerCount,
    }
  })

  ipcMain.handle('reports:consumption', async (_, { from, to }: { from: string; to: string }) => {
    const movements = await prisma.stockMovement.findMany({
      where: {
        createdAt: { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59.999') },
        type: { in: ['sale', 'waste'] },
      },
      include: { ingredient: true },
    })

    const grouped: Record<number, any> = {}
    for (const mov of movements) {
      if (!grouped[mov.ingredientId]) {
        grouped[mov.ingredientId] = {
          ingredient: mov.ingredient,
          saleQty: 0,
          wasteQty: 0,
        }
      }
      if (mov.type === 'sale') grouped[mov.ingredientId].saleQty += Math.abs(mov.quantity)
      if (mov.type === 'waste') grouped[mov.ingredientId].wasteQty += Math.abs(mov.quantity)
    }
    return Object.values(grouped)
  })

  ipcMain.handle('reports:productCosts', async () => {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { recipes: { include: { ingredient: true } } },
    })
    return products.map(product => {
      const rawCost = product.recipes.reduce(
        (sum, r) => sum + r.quantity * r.ingredient.costPerUnit,
        0
      )
      return {
        id:       product.id,
        name:     product.name,
        category: product.category,
        price:    product.price,
        isActive: product.isActive,
        rawCost,
        profit:   product.price - rawCost,
        margin:   product.price > 0 ? ((product.price - rawCost) / product.price) * 100 : 0,
        items: product.recipes.map(r => ({
          ingredientName: r.ingredient.name,
          unit:           r.ingredient.unit,
          quantity:       r.quantity,
          costPerUnit:    r.ingredient.costPerUnit,
          subtotal:       r.quantity * r.ingredient.costPerUnit,
        })),
      }
    })
  })

  // ─── AUTH / USERS ───────────────────────────────────────────────
  ipcMain.handle('auth:listUsers', () =>
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })
  )

  ipcMain.handle('auth:login', async (_, userId: number, pin: string) => {
    const user = await prisma.user.findFirst({
      where: { id: userId, pin, isActive: true },
      select: { id: true, name: true, role: true, isActive: true, createdAt: true },
    })
    if (!user) return null
    const roleData = await resolveRole(user.role)
    return { ...user, roleData }
  })

  ipcMain.handle('auth:getAll', async () => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    return Promise.all(users.map(async u => ({ ...u, roleData: await resolveRole(u.role) })))
  })

  ipcMain.handle('auth:create', (_, { name, pin, role }: { name: string; pin: string; role: string }) =>
    prisma.user.create({ data: { name, pin, role } })
  )

  ipcMain.handle('auth:update', (_, { id, ...data }: any) =>
    prisma.user.update({ where: { id }, data })
  )

  ipcMain.handle('auth:delete', (_, id: number) =>
    prisma.user.delete({ where: { id } })
  )

  // ─── ROLES ──────────────────────────────────────────────────────
  ipcMain.handle('roles:getAll', async () => {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
    return roles.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]') as string[] }))
  })

  ipcMain.handle('roles:create', async (_, {
    name, fullAccess, permissions,
  }: { name: string; fullAccess: boolean; permissions: string[] }) => {
    const r = await prisma.role.create({
      data: { name, fullAccess, permissions: JSON.stringify(permissions) },
    })
    return { ...r, permissions: JSON.parse(r.permissions) as string[] }
  })

  ipcMain.handle('roles:update', async (_, {
    id, name, fullAccess, permissions,
  }: { id: number; name: string; fullAccess: boolean; permissions: string[] }) => {
    const existing = await prisma.role.findUnique({ where: { id } })
    if (existing?.isSystem && !fullAccess) throw new Error('لا يمكن تقييد صلاحيات وظيفة مدير النظام')
    const r = await prisma.role.update({
      where: { id },
      data: { name: existing?.isSystem ? existing.name : name, fullAccess, permissions: JSON.stringify(permissions) },
    })
    return { ...r, permissions: JSON.parse(r.permissions) as string[] }
  })

  ipcMain.handle('roles:delete', async (_, id: number) => {
    const role = await prisma.role.findUnique({ where: { id } })
    if (role?.isSystem) throw new Error('لا يمكن حذف وظيفة مدير النظام')
    const userCount = await prisma.user.count({ where: { role: role?.name ?? '' } })
    if (userCount > 0) throw new Error(`لا يمكن الحذف — هناك ${userCount} مستخدم بهذه الوظيفة`)
    return prisma.role.delete({ where: { id } })
  })

  // ─── SETTINGS ───────────────────────────────────────────────────
  const DEFAULT_SETTINGS: Record<string, string> = {
    restaurantName: 'نظام المطعم',
    currency: 'ج.م',
    taxRate: '0',
    autoBackupEnabled: 'false',
    autoBackupPath: '',
    autoBackupInterval: 'daily',
    autoBackupLastRun: '',
    // كم وحدة عملة تساوي نقطة ولاء واحدة — 0 يعني الإيقاف (لا تراكم تلقائي)
    loyaltyPointsPerCurrency: '0',
  }

  ipcMain.handle('settings:getAll', async () => {
    const rows = await prisma.setting.findMany()
    const result: Record<string, string> = { ...DEFAULT_SETTINGS }
    rows.forEach(r => { result[r.key] = r.value })
    return result
  })

  ipcMain.handle('settings:set', (_, key: string, value: string) =>
    prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  )

  // ─── ACTIVITY LOG ───────────────────────────────────────────────
  ipcMain.handle('activity:log', (_, data: {
    userId: number; action: string; entity?: string; entityId?: number; details?: string
  }) =>
    prisma.activityLog.create({
      data,
      include: { user: { select: { id: true, name: true, role: true } } },
    })
  )

  ipcMain.handle('activity:getAll', () =>
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, role: true } } },
      take: 300,
    })
  )

  // ─── WASTE ──────────────────────────────────────────────────────
  ipcMain.handle('stock:waste', async (_, { ingredientId, quantity, note }: {
    ingredientId: number; quantity: number; note?: string
  }) => {
    const q = Math.abs(quantity)
    await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { currentStock: { decrement: q } },
    })
    return prisma.stockMovement.create({
      data: { ingredientId, quantity: -q, type: 'waste', note: note ?? null },
    })
  })

  ipcMain.handle('stock:getWaste', () =>
    prisma.stockMovement.findMany({
      where: { type: 'waste' },
      orderBy: { createdAt: 'desc' },
      include: { ingredient: true },
      take: 300,
    })
  )

  // ─── EXPENSES (فواتير المصاريف) ─────────────────────────────────
  ipcMain.handle('expenses:getAll', (_, { from, to }: { from?: string; to?: string } = {}) => {
    const where: any = {}
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from + 'T00:00:00')
      if (to) where.date.lte = new Date(to + 'T23:59:59.999')
    }
    return prisma.expense.findMany({ where, orderBy: { date: 'desc' } })
  })

  ipcMain.handle('expenses:create', (_, data: any) =>
    prisma.expense.create({
      data: {
        date:          new Date(data.date),
        category:      data.category      || 'other',
        type:          data.type          || 'indirect',
        description:   data.description,
        amount:        data.amount,
        invoiceNumber: data.invoiceNumber || null,
        vendor:        data.vendor        || null,
        notes:         data.notes         || null,
      },
    })
  )

  ipcMain.handle('expenses:update', (_, { id, ...data }: any) =>
    prisma.expense.update({
      where: { id },
      data: {
        date:          data.date ? new Date(data.date) : undefined,
        category:      data.category,
        type:          data.type,
        description:   data.description,
        amount:        data.amount,
        invoiceNumber: data.invoiceNumber || null,
        vendor:        data.vendor        || null,
        notes:         data.notes         || null,
      },
    })
  )

  ipcMain.handle('expenses:delete', (_, id: number) =>
    prisma.expense.delete({ where: { id } })
  )

  // ─── INCOME STATEMENT (قائمة الدخل) ────────────────────────────
  ipcMain.handle('reports:incomeStatement', async (_, { from, to }: { from: string; to: string }) => {
    const fromDate = new Date(from + 'T00:00:00')
    const toDate   = new Date(to + 'T23:59:59.999')

    const [posOrders, manualSales, saleMoves, wasteMoves, purchases, overhead, expenseRows] = await Promise.all([
      // إيرادات POS (مكتملة فقط)
      prisma.posOrder.findMany({
        where: { status: 'completed', createdAt: { gte: fromDate, lte: toDate } },
      }),
      // مبيعات يدوية مؤكدة (غير POS لتفادي التكرار)
      prisma.sale.findMany({
        where: { status: 'confirmed', source: { not: 'pos' }, saleDate: { gte: fromDate, lte: toDate } },
      }),
      // حركات المبيعات لحساب COGS
      prisma.stockMovement.findMany({
        where: { type: 'sale', createdAt: { gte: fromDate, lte: toDate } },
        include: { ingredient: true },
      }),
      // حركات الهدر
      prisma.stockMovement.findMany({
        where: { type: 'waste', createdAt: { gte: fromDate, lte: toDate } },
        include: { ingredient: true },
      }),
      // مشتريات الفترة (للمعلومية)
      prisma.purchaseInvoice.findMany({
        where: { status: 'confirmed', invoiceDate: { gte: fromDate, lte: toDate } },
      }),
      // مراكز التكلفة النشطة
      prisma.overheadEntry.findMany({
        where:   { isActive: true },
        orderBy: [{ type: 'asc' }, { category: 'asc' }],
      }),
      // فواتير المصاريف الفعلية للفترة
      prisma.expense.findMany({
        where:   { date: { gte: fromDate, lte: toDate } },
        orderBy: [{ type: 'asc' }, { category: 'asc' }, { date: 'asc' }],
      }),
    ])

    // ── الإيرادات ──────────────────────────────────────────────────
    const posSubtotal   = posOrders.reduce((s, o) => s + o.subtotal, 0)
    const posDiscounts  = posOrders.reduce((s, o) => s + o.discountAmount, 0)
    const posCommission = posOrders.reduce((s, o) => s + o.commissionAmount, 0)
    const manualRev     = manualSales.reduce((s, s2) => s + s2.total, 0)
    const totalRevenue  = posSubtotal + manualRev
    const netRevenue    = totalRevenue - posDiscounts - posCommission

    // ── تكلفة البضاعة المباعة COGS ────────────────────────────────
    const cogs = saleMoves.reduce((s, m) => s + Math.abs(m.quantity) * m.ingredient.costPerUnit, 0)
    const wasteValue = wasteMoves.reduce((s, m) => s + Math.abs(m.quantity) * m.ingredient.costPerUnit, 0)

    const grossProfit = netRevenue - cogs
    const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0

    // ── تقسيط مصاريف المراكز على الفترة ──────────────────────────
    const days   = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)))
    const months = days / 30

    const toEntry = (e: typeof overhead[0]) => ({
      id: e.id, name: e.name, category: e.category,
      monthlyAmount: e.amount,
      periodAmount:  parseFloat((e.amount * months).toFixed(2)),
    })

    const directEntries   = overhead.filter(e => e.type === 'direct').map(toEntry)
    const indirectEntries = overhead.filter(e => e.type === 'indirect').map(toEntry)

    const totalDirect   = directEntries.reduce((s, e) => s + e.periodAmount, 0)
    const totalIndirect = indirectEntries.reduce((s, e) => s + e.periodAmount, 0)
    const totalExpenses = totalDirect + totalIndirect

    const operatingProfit = grossProfit - totalExpenses
    const netMargin       = netRevenue > 0 ? (operatingProfit / netRevenue) * 100 : 0

    // ── فواتير المصاريف الفعلية ───────────────────────────────────
    const expenseDirect   = expenseRows.filter(e => e.type === 'direct')
    const expenseIndirect = expenseRows.filter(e => e.type === 'indirect')
    const totalExpDirect   = expenseDirect.reduce((s, e) => s + e.amount, 0)
    const totalExpIndirect = expenseIndirect.reduce((s, e) => s + e.amount, 0)
    const totalActualExp   = totalExpDirect + totalExpIndirect

    // تحديث صافي الربح ليشمل المصاريف الفعلية + المقسَّطة
    const totalAllExpenses    = totalExpenses + totalActualExp
    const operatingProfitFull = grossProfit - totalAllExpenses
    const netMarginFull       = netRevenue > 0 ? (operatingProfitFull / netRevenue) * 100 : 0

    return {
      period:  { from, to, days, months },
      revenue: {
        pos: posSubtotal, manual: manualRev, total: totalRevenue,
        discounts: posDiscounts, commissions: posCommission, net: netRevenue,
      },
      cogs, wasteValue,
      grossProfit, grossMargin,
      expenses: {
        direct: directEntries, indirect: indirectEntries,
        totalDirect, totalIndirect, total: totalExpenses, months, days,
      },
      operatingProfit: operatingProfitFull,
      netMargin:       netMarginFull,
      purchases: purchases.reduce((s, p) => s + p.total, 0),
      actualExpenses: {
        direct:        expenseDirect,
        indirect:      expenseIndirect,
        totalDirect:   totalExpDirect,
        totalIndirect: totalExpIndirect,
        total:         totalActualExp,
      },
    }
  })

  // ─── BACKUP ─────────────────────────────────────────────────────
  ipcMain.handle('backup:create', async () => {
    const { dialog } = await import('electron')
    const { copyFile } = await import('node:fs/promises')
    const date = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog({
      title: 'حفظ نسخة احتياطية',
      defaultPath: `restaurant-backup-${date}.db`,
      filters: [{ name: 'Database', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePath) return null
    await copyFile(dbPath, result.filePath)
    return result.filePath
  })

  ipcMain.handle('backup:selectFolder', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: 'اختر مجلد النسخ الاحتياطي',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // ─── CHART OF ACCOUNTS (دليل الحسابات) ──────────────────────────
  ipcMain.handle('accounts:getAll', () =>
    prisma.chartOfAccount.findMany({ orderBy: { code: 'asc' } })
  )
  ipcMain.handle('accounts:create', (_, d: any) =>
    prisma.chartOfAccount.create({ data: {
      code: d.code, name: d.name, type: d.type,
      subType: d.subType ?? null, parentCode: d.parentCode ?? null,
      notes: d.notes ?? null,
    }})
  )
  ipcMain.handle('accounts:update', (_, { id, ...d }: any) =>
    prisma.chartOfAccount.update({ where: { id }, data: {
      code: d.code, name: d.name, type: d.type,
      subType: d.subType ?? null, parentCode: d.parentCode ?? null,
      notes: d.notes ?? null, isActive: d.isActive,
    }})
  )
  ipcMain.handle('accounts:delete', (_, id: number) =>
    prisma.chartOfAccount.delete({ where: { id } })
  )
  ipcMain.handle('accounts:seed', async () => {
    const exists = await prisma.chartOfAccount.count()
    if (exists > 0) return { seeded: false }
    const accounts = [
      // الأصول
      { code: '1000', name: 'الأصول', type: 'asset', subType: 'header', parentCode: null },
      { code: '1100', name: 'الأصول المتداولة', type: 'asset', subType: 'header', parentCode: '1000' },
      { code: '1110', name: 'النقدية بالصندوق', type: 'asset', subType: 'current_asset', parentCode: '1100' },
      { code: '1120', name: 'الحسابات البنكية', type: 'asset', subType: 'current_asset', parentCode: '1100' },
      { code: '1130', name: 'العملاء / المدينون', type: 'asset', subType: 'current_asset', parentCode: '1100' },
      { code: '1140', name: 'المخزون', type: 'asset', subType: 'current_asset', parentCode: '1100' },
      { code: '1150', name: 'المصروفات المدفوعة مقدماً', type: 'asset', subType: 'current_asset', parentCode: '1100' },
      { code: '1200', name: 'الأصول الثابتة', type: 'asset', subType: 'header', parentCode: '1000' },
      { code: '1210', name: 'المعدات والأجهزة', type: 'asset', subType: 'fixed_asset', parentCode: '1200' },
      { code: '1220', name: 'الأثاث والتجهيزات', type: 'asset', subType: 'fixed_asset', parentCode: '1200' },
      { code: '1230', name: 'مجمع إهلاك المعدات', type: 'asset', subType: 'fixed_asset', parentCode: '1200' },
      // الخصوم
      { code: '2000', name: 'الخصوم', type: 'liability', subType: 'header', parentCode: null },
      { code: '2100', name: 'الخصوم المتداولة', type: 'liability', subType: 'header', parentCode: '2000' },
      { code: '2110', name: 'الموردون / الدائنون', type: 'liability', subType: 'current_liability', parentCode: '2100' },
      { code: '2120', name: 'الضرائب المستحقة', type: 'liability', subType: 'current_liability', parentCode: '2100' },
      { code: '2130', name: 'مصروفات مستحقة الدفع', type: 'liability', subType: 'current_liability', parentCode: '2100' },
      { code: '2200', name: 'الخصوم طويلة الأجل', type: 'liability', subType: 'header', parentCode: '2000' },
      { code: '2210', name: 'قروض بنكية', type: 'liability', subType: 'long_term_liability', parentCode: '2200' },
      // حقوق الملكية
      { code: '3000', name: 'حقوق الملكية', type: 'equity', subType: 'header', parentCode: null },
      { code: '3100', name: 'رأس المال', type: 'equity', subType: 'equity', parentCode: '3000' },
      { code: '3200', name: 'الأرباح المحتجزة', type: 'equity', subType: 'equity', parentCode: '3000' },
      { code: '3300', name: 'صافي الربح / الخسارة', type: 'equity', subType: 'equity', parentCode: '3000' },
      // الإيرادات
      { code: '4000', name: 'الإيرادات', type: 'revenue', subType: 'header', parentCode: null },
      { code: '4100', name: 'إيرادات المبيعات — محل', type: 'revenue', subType: 'revenue', parentCode: '4000' },
      { code: '4110', name: 'إيرادات نقطة البيع', type: 'revenue', subType: 'revenue', parentCode: '4100' },
      { code: '4120', name: 'مبيعات يدوية', type: 'revenue', subType: 'revenue', parentCode: '4100' },
      { code: '4200', name: 'إيرادات التوصيل', type: 'revenue', subType: 'revenue', parentCode: '4000' },
      { code: '4900', name: 'مردودات ومسموحات المبيعات', type: 'revenue', subType: 'contra_revenue', parentCode: '4000' },
      // تكلفة المبيعات
      { code: '5000', name: 'تكلفة البضاعة المباعة', type: 'expense', subType: 'cogs', parentCode: null },
      { code: '5100', name: 'تكلفة المواد الخام', type: 'expense', subType: 'cogs', parentCode: '5000' },
      { code: '5200', name: 'مصاريف إنتاج مباشرة', type: 'expense', subType: 'cogs', parentCode: '5000' },
      { code: '5210', name: 'رواتب المطبخ', type: 'expense', subType: 'cogs', parentCode: '5200' },
      { code: '5220', name: 'وقود المطبخ', type: 'expense', subType: 'cogs', parentCode: '5200' },
      { code: '5230', name: 'تغليف', type: 'expense', subType: 'cogs', parentCode: '5200' },
      { code: '5300', name: 'هدر ومتالف', type: 'expense', subType: 'cogs', parentCode: '5000' },
      // المصاريف التشغيلية
      { code: '6000', name: 'المصاريف التشغيلية', type: 'expense', subType: 'operating', parentCode: null },
      { code: '6100', name: 'مصاريف الموظفين', type: 'expense', subType: 'operating', parentCode: '6000' },
      { code: '6110', name: 'رواتب الإدارة والخدمة', type: 'expense', subType: 'operating', parentCode: '6100' },
      { code: '6120', name: 'مكافآت وحوافز', type: 'expense', subType: 'operating', parentCode: '6100' },
      { code: '6200', name: 'مصاريف المحل', type: 'expense', subType: 'operating', parentCode: '6000' },
      { code: '6210', name: 'إيجار المحل', type: 'expense', subType: 'operating', parentCode: '6200' },
      { code: '6220', name: 'الكهرباء', type: 'expense', subType: 'operating', parentCode: '6200' },
      { code: '6230', name: 'الغاز', type: 'expense', subType: 'operating', parentCode: '6200' },
      { code: '6240', name: 'المياه', type: 'expense', subType: 'operating', parentCode: '6200' },
      { code: '6250', name: 'الاتصالات والإنترنت', type: 'expense', subType: 'operating', parentCode: '6200' },
      { code: '6300', name: 'مصاريف الصيانة', type: 'expense', subType: 'operating', parentCode: '6000' },
      { code: '6310', name: 'صيانة المعدات', type: 'expense', subType: 'operating', parentCode: '6300' },
      { code: '6320', name: 'إهلاك المعدات', type: 'expense', subType: 'operating', parentCode: '6300' },
      { code: '6400', name: 'مصاريف التسويق', type: 'expense', subType: 'operating', parentCode: '6000' },
      { code: '6410', name: 'إعلانات ووسائل التواصل', type: 'expense', subType: 'operating', parentCode: '6400' },
      { code: '6420', name: 'عروض وخصومات', type: 'expense', subType: 'operating', parentCode: '6400' },
      { code: '6500', name: 'مصاريف إدارية', type: 'expense', subType: 'operating', parentCode: '6000' },
      { code: '6510', name: 'رسوم وتراخيص', type: 'expense', subType: 'operating', parentCode: '6500' },
      { code: '6520', name: 'تأمين', type: 'expense', subType: 'operating', parentCode: '6500' },
      { code: '6530', name: 'قرطاسية ومستلزمات مكتب', type: 'expense', subType: 'operating', parentCode: '6500' },
      { code: '6540', name: 'نظافة عامة', type: 'expense', subType: 'operating', parentCode: '6500' },
      { code: '6600', name: 'مصاريف مالية', type: 'expense', subType: 'operating', parentCode: '6000' },
      { code: '6610', name: 'فوائد بنكية', type: 'expense', subType: 'operating', parentCode: '6600' },
      { code: '6620', name: 'عمولات بنكية', type: 'expense', subType: 'operating', parentCode: '6600' },
      { code: '6900', name: 'مصاريف أخرى', type: 'expense', subType: 'operating', parentCode: '6000' },
    ]
    await prisma.chartOfAccount.createMany({ data: accounts })
    return { seeded: true, count: accounts.length }
  })

  // auto-code helper: next available child code under a parent
  ipcMain.handle('accounts:getNextCode', async (_, parentCode: string | null) => {
    const siblings = await prisma.chartOfAccount.findMany({
      where: { parentCode: parentCode ?? null },
      orderBy: { code: 'asc' },
    })
    if (!parentCode) {
      // root level: 1000, 2000 …
      const nums = siblings.map(s => parseInt(s.code)).filter(n => !isNaN(n))
      const max  = nums.length ? Math.max(...nums) : 0
      const next = Math.floor(max / 1000) * 1000 + 1000
      return String(next)
    }
    // determine step based on parent code length → depth
    const depth = parentCode.length  // 4→children step 10, 5→step 1, etc.
    const step  = depth <= 3 ? 100 : depth === 4 ? 10 : 1
    const prefix = parentCode
    // existing children under this parent that start with parentCode
    const childNums = siblings
      .map(s => parseInt(s.code))
      .filter(n => !isNaN(n) && String(n).startsWith(parentCode))
    if (childNums.length === 0) {
      return parentCode + (step === 100 ? '00' : step === 10 ? '0' : '1')
    }
    const maxChild = Math.max(...childNums)
    return String(maxChild + step)
  })

  // ─── BANK ACCOUNTS (البنوك والعهد) ──────────────────────────────
  ipcMain.handle('banks:getAll', () =>
    prisma.bankAccount.findMany({
      orderBy: { name: 'asc' },
      include: { transactions: { orderBy: { date: 'desc' }, take: 1 } },
    })
  )

  ipcMain.handle('banks:create', async (_, d: any) => {
    const acc = await prisma.bankAccount.create({ data: {
      name: d.name, type: d.type ?? 'bank',
      bankName: d.bankName ?? null, accountNumber: d.accountNumber ?? null,
      balance: d.openingBalance ?? 0, currency: d.currency ?? 'EGP',
      linkedAccountCode: d.linkedAccountCode ?? null,
      notes: d.notes ?? null,
    }})
    // قيد افتتاحي إذا كان هناك رصيد أو كود حساب
    const code = d.linkedAccountCode
    if (code && (d.openingBalance ?? 0) > 0) {
      const entryNum = `JE-OPEN-${acc.id}-${Date.now()}`
      const contraCode = d.openingContraCode ?? '3100' // رأس المال افتراضياً
      const contraAcc  = await prisma.chartOfAccount.findUnique({ where: { code: contraCode } })
      const bankAcc    = await prisma.chartOfAccount.findUnique({ where: { code } })
      const je = await prisma.journalEntry.create({ data: {
        entryNumber: entryNum,
        date: new Date(),
        description: `رصيد افتتاحي — ${d.name}`,
        isAutomatic: true,
        lines: { create: [
          { accountCode: code,        accountName: bankAcc?.name  ?? d.name, debit:  d.openingBalance, credit: 0 },
          { accountCode: contraCode,  accountName: contraAcc?.name ?? 'رأس المال',  debit: 0, credit: d.openingBalance },
        ]},
      }})
      // ربط أول حركة بالقيد
      await prisma.bankTransaction.create({ data: {
        bankAccountId: acc.id,
        date: new Date(),
        type: 'credit',
        amount: d.openingBalance,
        description: 'رصيد افتتاحي',
        journalEntryId: je.id,
      }})
    }
    return acc
  })

  ipcMain.handle('banks:update', (_, { id, ...d }: any) =>
    prisma.bankAccount.update({ where: { id }, data: {
      name: d.name, type: d.type,
      bankName: d.bankName ?? null, accountNumber: d.accountNumber ?? null,
      currency: d.currency ?? 'EGP',
      linkedAccountCode: d.linkedAccountCode ?? null,
      notes: d.notes ?? null, isActive: d.isActive,
    }})
  )
  ipcMain.handle('banks:delete', (_, id: number) =>
    prisma.bankAccount.delete({ where: { id } })
  )

  // حركات البنك مع قيود مزدوجة
  ipcMain.handle('banks:getTransactions', (_, bankAccountId: number) =>
    prisma.bankTransaction.findMany({
      where: { bankAccountId },
      orderBy: { date: 'desc' },
      include: { journalEntry: { include: { lines: true } } },
    })
  )

  ipcMain.handle('banks:addTransaction', async (_, d: any) => {
    const bankAcc = await prisma.bankAccount.findUnique({ where: { id: d.bankAccountId } })
    if (!bankAcc) throw new Error('Bank account not found')

    const bankCode    = bankAcc.linkedAccountCode
    const contraCode  = d.contraAccountCode ?? null

    // إنشاء القيد اليومي إذا عندنا كودين
    let journalEntryId: number | null = null
    if (bankCode && contraCode) {
      const bankCoaAcc  = await prisma.chartOfAccount.findUnique({ where: { code: bankCode } })
      const contraCoaAcc= await prisma.chartOfAccount.findUnique({ where: { code: contraCode } })
      const entryNum    = `JE-${Date.now()}`
      // credit = إيداع: DR بنك / CR الحساب المقابل
      // debit  = سحب:   DR الحساب المقابل / CR بنك
      const je = await prisma.journalEntry.create({ data: {
        entryNumber: entryNum,
        date: new Date(d.date),
        description: d.description,
        reference: d.reference ?? null,
        isAutomatic: true,
        lines: { create: d.type === 'credit' ? [
          { accountCode: bankCode,   accountName: bankCoaAcc?.name  ?? bankAcc.name, debit:  d.amount, credit: 0 },
          { accountCode: contraCode, accountName: contraCoaAcc?.name ?? contraCode,  debit: 0, credit: d.amount },
        ] : [
          { accountCode: contraCode, accountName: contraCoaAcc?.name ?? contraCode,  debit:  d.amount, credit: 0 },
          { accountCode: bankCode,   accountName: bankCoaAcc?.name  ?? bankAcc.name, debit: 0, credit: d.amount },
        ]},
      }})
      journalEntryId = je.id
    }

    const tx = await prisma.bankTransaction.create({ data: {
      bankAccountId:     d.bankAccountId,
      date:              new Date(d.date),
      type:              d.type,
      amount:            d.amount,
      description:       d.description,
      contraAccountCode: contraCode,
      reference:         d.reference  ?? null,
      notes:             d.notes      ?? null,
      journalEntryId,
    }})

    const delta = d.type === 'credit' ? d.amount : -d.amount
    await prisma.bankAccount.update({
      where: { id: d.bankAccountId },
      data:  { balance: { increment: delta } },
    })
    return tx
  })

  ipcMain.handle('banks:deleteTransaction', async (_, id: number) => {
    const tx = await prisma.bankTransaction.findUnique({
      where: { id }, include: { journalEntry: true }
    })
    if (!tx) return
    const delta = tx.type === 'credit' ? -tx.amount : tx.amount
    await prisma.bankAccount.update({
      where: { id: tx.bankAccountId },
      data:  { balance: { increment: delta } },
    })
    await prisma.bankTransaction.delete({ where: { id } })
    if (tx.journalEntryId) {
      await prisma.journalEntry.delete({ where: { id: tx.journalEntryId } }).catch(() => {})
    }
  })

  // ─── JOURNAL ENTRIES (القيود اليومية) ───────────────────────────
  ipcMain.handle('journals:getAll', (_, params?: { from?: string; to?: string }) => {
    const where: any = {}
    if (params?.from) where.date = { ...where.date, gte: new Date(params.from + 'T00:00:00') }
    if (params?.to) where.date = { ...where.date, lte: new Date(params.to + 'T23:59:59.999') }
    return prisma.journalEntry.findMany({
      where, orderBy: { date: 'desc' },
      include: { lines: { orderBy: { debit: 'desc' } } },
    })
  })

  ipcMain.handle('journals:create', async (_, d: any) => {
    const count = await prisma.journalEntry.count()
    const entryNumber = d.entryNumber || `JE-${String(count + 1).padStart(5, '0')}`
    return prisma.journalEntry.create({ data: {
      entryNumber,
      date:        new Date(d.date),
      description: d.description,
      reference:   d.reference ?? null,
      isAutomatic: false,
      lines: { create: d.lines.map((l: any) => ({
        accountCode: l.accountCode,
        accountName: l.accountName ?? null,
        description: l.description ?? null,
        debit:       l.debit  ?? 0,
        credit:      l.credit ?? 0,
      }))},
    }})
  })

  ipcMain.handle('journals:delete', async (_, id: number) => {
    // لا تحذف القيود المرتبطة بحركات بنكية
    const linked = await prisma.bankTransaction.findFirst({ where: { journalEntryId: id } })
    if (linked) throw new Error('هذا القيد مرتبط بحركة بنكية، احذف الحركة أولاً')
    return prisma.journalEntry.delete({ where: { id } })
  })

  // ─── TRIAL BALANCE (ميزان المراجعة) ─────────────────────────────
  ipcMain.handle('reports:trialBalance', async (_, params?: { from?: string; to?: string }) => {
    const where: any = {}
    if (params?.from) where.date = { ...where.date, gte: new Date(params.from + 'T00:00:00') }
    if (params?.to) where.date = { ...where.date, lte: new Date(params.to + 'T23:59:59.999') }

    const [allAccounts, lines] = await Promise.all([
      prisma.chartOfAccount.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
      prisma.journalEntryLine.findMany({
        where: { journalEntry: where.date ? { date: where.date } : undefined },
        include: { journalEntry: true },
      }),
    ])

    // تجميع حركة كل حساب
    const map = new Map<string, { totalDebit: number; totalCredit: number }>()
    for (const line of lines) {
      const cur = map.get(line.accountCode) ?? { totalDebit: 0, totalCredit: 0 }
      cur.totalDebit  += line.debit
      cur.totalCredit += line.credit
      map.set(line.accountCode, cur)
    }

    // بناء الصفوف
    // نوع الحساب الطبيعي: asset+expense = مدين طبيعي | liability+equity+revenue = دائن طبيعي
    const debitNormal = (type: string) => type === 'asset' || type === 'expense'
    const rows = allAccounts
      .filter(a => a.subType !== 'header' && map.has(a.code))
      .map(a => {
        const { totalDebit, totalCredit } = map.get(a.code)!
        const netBalance = totalDebit - totalCredit
        return {
          code:         a.code,
          name:         a.name,
          type:         a.type,
          debitBalance:  netBalance > 0 ?  netBalance : 0,
          creditBalance: netBalance < 0 ? -netBalance : 0,
          totalDebit,
          totalCredit,
        }
      })

    const sumDebitBal  = rows.reduce((s, r) => s + r.debitBalance,  0)
    const sumCreditBal = rows.reduce((s, r) => s + r.creditBalance, 0)
    const sumDebitTx   = rows.reduce((s, r) => s + r.totalDebit,    0)
    const sumCreditTx  = rows.reduce((s, r) => s + r.totalCredit,   0)

    return { rows, sumDebitBal, sumCreditBal, sumDebitTx, sumCreditTx }
  })

  // ─── BALANCE SHEET (الميزانية العمومية) ──────────────────────────
  ipcMain.handle('reports:balanceSheet', async (_, params?: { asOf?: string }) => {
    const asOf = params?.asOf ? new Date(params.asOf + 'T23:59:59.999') : new Date()

    const [allAccounts, lines] = await Promise.all([
      prisma.chartOfAccount.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
      prisma.journalEntryLine.findMany({
        where: { journalEntry: { date: { lte: asOf } } },
      }),
    ])

    const map = new Map<string, { totalDebit: number; totalCredit: number }>()
    for (const line of lines) {
      const cur = map.get(line.accountCode) ?? { totalDebit: 0, totalCredit: 0 }
      cur.totalDebit  += line.debit
      cur.totalCredit += line.credit
      map.set(line.accountCode, cur)
    }

    const accountsByType: Record<string, any[]> = { asset: [], liability: [], equity: [], revenue: [], expense: [] }
    for (const acc of allAccounts) {
      if (acc.subType === 'header' || !map.has(acc.code)) continue
      const { totalDebit, totalCredit } = map.get(acc.code)!
      const balance = totalDebit - totalCredit
      const normalDebit = acc.type === 'asset' || acc.type === 'expense'
      accountsByType[acc.type]?.push({
        code: acc.code, name: acc.name, subType: acc.subType,
        balance: normalDebit ? balance : -balance,
        totalDebit, totalCredit,
      })
    }

    const sum = (arr: any[]) => arr.reduce((s, r) => s + r.balance, 0)
    return {
      asOf: asOf.toISOString(),
      assets:      accountsByType.asset,
      liabilities: accountsByType.liability,
      equity:      accountsByType.equity,
      revenue:     accountsByType.revenue,
      expenses:    accountsByType.expense,
      totalAssets:      sum(accountsByType.asset),
      totalLiabilities: sum(accountsByType.liability),
      totalEquity:      sum(accountsByType.equity),
      totalRevenue:     sum(accountsByType.revenue),
      totalExpenses:    sum(accountsByType.expense),
    }
  })

  // ─── CASH FLOW (التدفق النقدي) ───────────────────────────────────
  ipcMain.handle('reports:cashFlow', async (_, params?: { from?: string; to?: string }) => {
    const where: any = {}
    if (params?.from) where.date = { ...where.date, gte: new Date(params.from + 'T00:00:00') }
    if (params?.to) where.date = { ...where.date, lte: new Date(params.to + 'T23:59:59.999') }

    const txs = await prisma.bankTransaction.findMany({
      where, orderBy: { date: 'asc' },
      include: { bankAccount: { select: { name: true, type: true } } },
    })

    const byMonth = new Map<string, { inflow: number; outflow: number; net: number }>()
    let totalInflow = 0, totalOutflow = 0

    for (const tx of txs) {
      const month = tx.date.toISOString().slice(0, 7)
      const cur = byMonth.get(month) ?? { inflow: 0, outflow: 0, net: 0 }
      if (tx.type === 'credit') { cur.inflow += tx.amount; totalInflow += tx.amount }
      else                      { cur.outflow += tx.amount; totalOutflow += tx.amount }
      cur.net = cur.inflow - cur.outflow
      byMonth.set(month, cur)
    }

    const months = Array.from(byMonth.entries()).map(([month, data]) => ({ month, ...data }))
    return { months, totalInflow, totalOutflow, netCashFlow: totalInflow - totalOutflow, transactions: txs }
  })

  // ─── SUPPLIER DEBT (مديونية الموردين) ────────────────────────────
  ipcMain.handle('reports:supplierDebt', async () => {
    const invoices = await prisma.purchaseInvoice.findMany({
      where: { status: 'confirmed' },
      include: { supplier: true, items: true },
      orderBy: { invoiceDate: 'desc' },
    })

    const supplierMap = new Map<number | string, any>()
    for (const inv of invoices) {
      const key = inv.supplierId ?? 'unknown'
      const cur = supplierMap.get(key) ?? {
        supplierId: inv.supplierId,
        supplierName: inv.supplier?.name ?? 'غير محدد',
        invoiceCount: 0, totalAmount: 0, invoices: [],
      }
      cur.invoiceCount++
      cur.totalAmount += inv.total
      cur.invoices.push({ id: inv.id, invoiceNumber: inv.invoiceNumber, date: inv.invoiceDate, total: inv.total })
      supplierMap.set(key, cur)
    }

    const suppliers = Array.from(supplierMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)
    const grandTotal = suppliers.reduce((s, r) => s + r.totalAmount, 0)
    return { suppliers, grandTotal }
  })

  // ─── CUSTOMERS (العملاء) ─────────────────────────────────────────
  ipcMain.handle('customers:getAll', async (_, includeInactive?: boolean) => {
    return prisma.customer.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    })
  })

  ipcMain.handle('customers:create', async (_, d: any) => {
    return prisma.customer.create({ data: {
      name:          d.name,
      phone:         d.phone         ?? null,
      email:         d.email         ?? null,
      birthDate:     d.birthDate     ?? null,
      loyaltyPoints: d.loyaltyPoints ?? 0,
      notes:         d.notes         ?? null,
    }})
  })

  ipcMain.handle('customers:update', async (_, d: any) => {
    return prisma.customer.update({ where: { id: d.id }, data: {
      name:          d.name,
      phone:         d.phone         ?? null,
      email:         d.email         ?? null,
      birthDate:     d.birthDate     ?? null,
      loyaltyPoints: d.loyaltyPoints ?? 0,
      notes:         d.notes         ?? null,
      isActive:      d.isActive      ?? true,
    }})
  })

  ipcMain.handle('customers:delete', async (_, id: number) => {
    return prisma.customer.delete({ where: { id } })
  })

  ipcMain.handle('customers:addPoints', async (_, d: { id: number; points: number }) => {
    return prisma.customer.update({
      where: { id: d.id },
      data: { loyaltyPoints: { increment: d.points } },
    })
  })

  // ─── RESERVATIONS (الحجوزات) ─────────────────────────────────────
  // keep the floor plan (Table.status) in sync so a seated reservation can't be double-booked
  async function syncTableStatusForReservation(tableId: number | null | undefined, status: string) {
    if (!tableId) return
    if (status === 'seated') {
      await prisma.table.update({ where: { id: tableId }, data: { status: 'occupied' } })
    } else if (status === 'completed' || status === 'cancelled') {
      await prisma.table.update({ where: { id: tableId }, data: { status: 'available' } })
    }
  }

  ipcMain.handle('reservations:getAll', async (_, params?: { from?: string; to?: string; status?: string }) => {
    const where: any = {}
    if (params?.from) where.reservationDate = { ...where.reservationDate, gte: new Date(params.from + 'T00:00:00') }
    if (params?.to) where.reservationDate = { ...where.reservationDate, lte: new Date(params.to + 'T23:59:59.999') }
    if (params?.status) where.status = params.status
    return prisma.reservation.findMany({
      where, orderBy: { reservationDate: 'asc' },
      include: { customer: true, table: true },
    })
  })

  ipcMain.handle('reservations:create', async (_, d: any) => {
    const status = d.status ?? 'pending'
    const created = await prisma.reservation.create({ data: {
      customerId:      d.customerId      ?? null,
      tableId:         d.tableId         ?? null,
      guestName:       d.guestName,
      guestPhone:      d.guestPhone      ?? null,
      reservationDate: new Date(d.reservationDate),
      partySize:       d.partySize       ?? 2,
      status,
      notes:           d.notes           ?? null,
    }, include: { customer: true, table: true } })
    await syncTableStatusForReservation(created.tableId, status)
    return created
  })

  ipcMain.handle('reservations:update', async (_, d: any) => {
    const updated = await prisma.reservation.update({ where: { id: d.id }, data: {
      customerId:      d.customerId      ?? null,
      tableId:         d.tableId         ?? null,
      guestName:       d.guestName,
      guestPhone:      d.guestPhone      ?? null,
      reservationDate: new Date(d.reservationDate),
      partySize:       d.partySize       ?? 2,
      status:          d.status,
      notes:           d.notes           ?? null,
    }, include: { customer: true, table: true } })
    await syncTableStatusForReservation(updated.tableId, updated.status)
    return updated
  })

  ipcMain.handle('reservations:updateStatus', async (_, d: { id: number; status: string }) => {
    const updated = await prisma.reservation.update({
      where: { id: d.id },
      data: { status: d.status },
      include: { customer: true, table: true },
    })
    await syncTableStatusForReservation(updated.tableId, updated.status)
    return updated
  })

  ipcMain.handle('reservations:delete', async (_, id: number) => {
    const existing = await prisma.reservation.findUnique({ where: { id } })
    if (existing?.status === 'seated') await syncTableStatusForReservation(existing.tableId, 'completed')
    return prisma.reservation.delete({ where: { id } })
  })

  // ─── BACKUP RESTORE ───────────────────────────────────────────────
  ipcMain.handle('backup:restore', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'اختر ملف النسخة الاحتياطية',
      filters: [{ name: 'قاعدة البيانات', extensions: ['db'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const src = result.filePaths[0]
    const { copyFile } = await import('node:fs/promises')
    await prisma.$disconnect()
    await copyFile(src, dbPath)
    await prisma.$connect()
    return src
  })
}

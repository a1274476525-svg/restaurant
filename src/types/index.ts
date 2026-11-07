export interface Branch {
  id: number
  name: string
  isDefault: boolean
  createdAt: string
  warehouses?: Warehouse[]
}

export interface Warehouse {
  id: number
  name: string
  branchId: number
  branch?: Branch
  isDefault: boolean
  createdAt: string
  stocks?: WarehouseStock[]
}

export interface WarehouseStock {
  id: number
  warehouseId: number
  ingredientId: number
  ingredient?: Ingredient
  quantity: number
}

export interface TransferRequest {
  id: number
  referenceNumber: string
  fromWarehouseId: number
  fromWarehouse?: Warehouse
  toWarehouseId: number
  toWarehouse?: Warehouse
  status: 'pending' | 'approved' | 'rejected' | 'transferred'
  note: string | null
  requestDate: string
  createdAt: string
  items: TransferRequestItem[]
  transfer?: Transfer | null
}

export interface TransferRequestItem {
  id: number
  requestId: number
  ingredientId: number
  ingredient: Ingredient
  quantity: number
  notes: string | null
}

export interface Transfer {
  id: number
  referenceNumber: string
  requestId: number | null
  fromWarehouseId: number
  fromWarehouse?: Warehouse
  toWarehouseId: number
  toWarehouse?: Warehouse
  transferDate: string
  note: string | null
  createdAt: string
  items: TransferItem[]
  request?: TransferRequest | null
}

export interface TransferItem {
  id: number
  transferId: number
  ingredientId: number
  ingredient: Ingredient
  quantity: number
}

export interface Ingredient {
  id: number
  name: string
  secondaryName: string | null
  sku: string | null
  barcode: string | null
  category: string | null
  unit: string
  storageUnit: string | null
  conversionFactor: number
  costPerUnit: number
  currentStock: number
  minStockAlert: number
  reorderLevel: number
  maxStockAlert: number
  isArchived: boolean
  createdAt: string
}

export interface Product {
  id: number
  name: string
  price: number
  category: string | null
  isActive: boolean
  imagePath: string | null
  createdAt: string
  recipes?: RecipeItem[]
}

export interface Table {
  id: number
  number: string
  capacity: number
  zone: string | null
  status: 'available' | 'occupied' | 'reserved'
  note: string | null
  createdAt: string
}

export interface Promotion {
  id: number
  name: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startDate: string
  endDate: string
  isActive: boolean
  applyToAll: boolean
  createdAt: string
  products: { id: number; productId: number; product: Product }[]
}

export interface RecipeItem {
  id: number
  productId: number
  ingredientId: number
  quantity: number
  ingredient: Ingredient
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  address: string | null
  createdAt: string
}

export interface PurchaseInvoice {
  id: number
  supplierId: number | null
  supplier: Supplier | null
  invoiceNumber: string | null
  invoiceDate: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  notes: string | null
  status: 'draft' | 'confirmed'
  createdAt: string
  items: PurchaseItem[]
}

export interface PurchaseItem {
  id: number
  invoiceId: number
  ingredientId: number
  ingredient: Ingredient
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface Sale {
  id: number
  productId: number
  product: Product
  customerId: number | null
  customer?: Customer | null
  quantity: number
  unitPrice: number
  total: number
  source: string
  status: 'draft' | 'confirmed'
  note: string | null
  saleDate: string
  createdAt: string
}

export interface StockMovement {
  id: number
  ingredientId: number
  ingredient: Ingredient
  quantity: number
  type: 'purchase' | 'sale' | 'waste' | 'adjust' | 'production'
  referenceId: number | null
  note: string | null
  createdAt: string
}

export interface Production {
  id: number
  note: string | null
  date: string
  createdAt: string
  items: ProductionItem[]
}

export interface ProductionItem {
  id: number
  productionId: number
  ingredientId: number
  ingredient: Ingredient
  quantity: number
  type: 'input' | 'output'
}

export interface PurchaseRequest {
  id: number
  supplierId: number | null
  supplier: Supplier | null
  status: 'pending' | 'approved' | 'ordered' | 'completed' | 'cancelled'
  notes: string | null
  requestDate: string
  createdAt: string
  items: PurchaseRequestItem[]
}

export interface PurchaseRequestItem {
  id: number
  requestId: number
  ingredientId: number
  ingredient: Ingredient
  quantity: number
  notes: string | null
}

export interface InventoryCount {
  id: number
  referenceNumber: string
  status: 'draft' | 'closed'
  workDate: string | null
  closedAt: string | null
  note: string | null
  createdAt: string
  items: InventoryCountItem[]
}

export interface InventoryCountItem {
  id: number
  inventoryCountId: number
  ingredientId: number
  ingredient: Ingredient
  systemQuantity: number
  actualQuantity: number
}

export interface DashboardData {
  ingredientCount: number
  productCount: number
  lowStockCount: number
  lowStockItems: Ingredient[]
  recentSales: Sale[]
  totalSalesToday: number
  salesTodayCount: number
  posRevToday: number
  posOrdersToday: number
  recentPosOrders: PosOrder[]
  reservationsToday: number
  pendingReservations: number
  customerCount: number
}

export interface Role {
  id: number
  name: string
  fullAccess: boolean
  permissions: string[]
  isSystem: boolean
}

export interface User {
  id: number
  name: string
  role: string       // role name stored in DB
  roleData: Role | null
  isActive: boolean
  createdAt: string
}

export interface ActivityLog {
  id: number
  userId: number
  user: Pick<User, 'id' | 'name' | 'role'>
  action: string
  entity: string | null
  entityId: number | null
  details: string | null
  createdAt: string
}

export interface DeliveryPartner {
  id: number
  name: string
  commissionType: 'percentage' | 'fixed'
  commission: number
  contractStart: string | null
  contractEnd: string | null
  contractNotes: string | null
  isActive: boolean
  createdAt: string
  prices?: DeliveryProductPrice[]
}

export interface DeliveryProductPrice {
  id: number
  partnerId: number
  productId: number
  price: number
}

export interface PosOrderItem {
  id: number
  orderId: number
  productId: number
  productName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Customer {
  id:            number
  name:          string
  phone:         string | null
  email:         string | null
  birthDate:     string | null
  loyaltyPoints: number
  notes:         string | null
  isActive:      boolean
  createdAt:     string
}

export interface Reservation {
  id:              number
  customerId:      number | null
  customer?:       Customer | null
  tableId:         number | null
  table?:          Table | null
  guestName:       string
  guestPhone:      string | null
  reservationDate: string
  partySize:       number
  status:          'pending' | 'confirmed' | 'cancelled' | 'seated' | 'completed'
  notes:           string | null
  createdAt:       string
}

export interface PosOrder {
  id: number
  orderNumber: string
  orderType: 'dine_in' | 'takeaway' | 'delivery_own' | 'delivery_external'
  tableId: number | null
  customerId: number | null
  customer?: Customer | null
  deliveryPartnerId: number | null
  commissionAmount: number
  paymentMethod: string
  subtotal: number
  discountType: string | null
  discountValue: number
  discountAmount: number
  total: number
  note: string | null
  status: 'completed' | 'voided'
  createdAt: string
  items: PosOrderItem[]
  deliveryPartner?: DeliveryPartner | null
}

export interface Expense {
  id:            number
  date:          string
  category:      string
  type:          'direct' | 'indirect'
  description:   string
  amount:        number
  invoiceNumber: string | null
  vendor:        string | null
  notes:         string | null
  createdAt:     string
}

export interface OverheadEntry {
  id: number
  name: string
  category: string
  type: 'direct' | 'indirect'
  amount: number
  isActive: boolean
  note: string | null
  createdAt: string
}

export interface ChartOfAccount {
  id:         number
  code:       string
  name:       string
  type:       'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  subType:    string | null
  parentCode: string | null
  isActive:   boolean
  notes:      string | null
  createdAt:  string
}

export interface BankAccount {
  id:                number
  name:              string
  type:              'bank' | 'custody' | 'cash'
  bankName:          string | null
  accountNumber:     string | null
  balance:           number
  currency:          string
  linkedAccountCode: string | null
  notes:             string | null
  isActive:          boolean
  createdAt:         string
  transactions?:     BankTransaction[]
}

export interface BankTransaction {
  id:                number
  bankAccountId:     number
  date:              string
  type:              'debit' | 'credit'
  amount:            number
  description:       string
  contraAccountCode: string | null
  reference:         string | null
  notes:             string | null
  journalEntryId:    number | null
  journalEntry?:     JournalEntry | null
  createdAt:         string
}

export interface JournalEntry {
  id:          number
  entryNumber: string
  date:        string
  description: string
  reference:   string | null
  isAutomatic: boolean
  createdAt:   string
  lines:       JournalEntryLine[]
}

export interface JournalEntryLine {
  id:             number
  journalEntryId: number
  accountCode:    string
  accountName:    string | null
  description:    string | null
  debit:          number
  credit:         number
}

export interface PriceHistory {
  id: number
  ingredientId: number
  price: number
  date: string
  note: string | null
}

export interface AppSettings {
  restaurantName: string
  currency: string
  taxRate: string
  autoBackupEnabled: string
  autoBackupPath: string
  autoBackupInterval: string
  autoBackupLastRun: string
  loyaltyPointsPerCurrency: string
}

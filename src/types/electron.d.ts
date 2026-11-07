import type {
  Ingredient, Product, RecipeItem, Supplier,
  PurchaseInvoice, Sale, StockMovement, DashboardData,
  Production, PurchaseRequest, InventoryCount, InventoryCountItem,
  Branch, Warehouse, WarehouseStock,
  TransferRequest, TransferRequestItem, Transfer, TransferItem,
  User, ActivityLog, AppSettings, Role, PriceHistory,
  Table, Promotion, PosOrder, DeliveryPartner, DeliveryProductPrice,
  OverheadEntry, Expense, ChartOfAccount, BankAccount, BankTransaction,
  JournalEntry, Customer, Reservation, JournalEntryLine,
} from './index'

declare global {
  interface Window {
    api: {
      ingredients: {
        getAll:          (includeArchived?: boolean) => Promise<Ingredient[]>
        getCategories:   ()                          => Promise<string[]>
        create:          (data: any)                 => Promise<Ingredient>
        update:          (data: any)                 => Promise<Ingredient>
        archive:         (id: number)                => Promise<Ingredient>
        restore:         (id: number)                => Promise<Ingredient>
        getPriceHistory: (id: number)                => Promise<PriceHistory[]>
      }
      products: {
        getAll:        ()                          => Promise<Product[]>
        create:        (data: any)                 => Promise<Product>
        update:        (data: any)                 => Promise<Product>
        delete:        (id: number)                => Promise<void>
        selectImage:   (productId: number)         => Promise<string | null>
        removeImage:   (productId: number)         => Promise<Product>
        getImageData:  (imagePath: string)         => Promise<string | null>
      }
      tables: {
        getAll:       ()           => Promise<Table[]>
        create:       (data: any)  => Promise<Table>
        update:       (data: any)  => Promise<Table>
        updateStatus: (data: any)  => Promise<Table>
        delete:       (id: number) => Promise<void>
      }
      promotions: {
        getAll:   ()           => Promise<Promotion[]>
        create:   (data: any)  => Promise<Promotion>
        update:   (data: any)  => Promise<Promotion>
        toggle:   (id: number) => Promise<Promotion>
        delete:   (id: number) => Promise<void>
      }
      recipes: {
        setForProduct: (data: {
          productId: number
          items: { ingredientId: number; quantity: number }[]
        }) => Promise<RecipeItem[]>
      }
      suppliers: {
        getAll:  ()           => Promise<Supplier[]>
        create:  (data: any)  => Promise<Supplier>
        update:  (data: any)  => Promise<Supplier>
        delete:  (id: number) => Promise<void>
      }
      invoices: {
        getAll:       ()           => Promise<PurchaseInvoice[]>
        getDrafts:    ()           => Promise<PurchaseInvoice[]>
        create:       (data: any)  => Promise<PurchaseInvoice>
        saveDraft:    (data: any)  => Promise<PurchaseInvoice>
        updateDraft:  (data: any)  => Promise<PurchaseInvoice>
        deleteDraft:  (id: number) => Promise<void>
        confirmDraft: (id: number) => Promise<PurchaseInvoice>
      }
      sales: {
        getAll:        ()              => Promise<Sale[]>
        create:        (data: any[])   => Promise<Sale[]>
        saveDraft:     (data: any[])   => Promise<Sale[]>
        getDrafts:     ()              => Promise<Sale[]>
        updateDraft:   (data: any)     => Promise<Sale>
        deleteDraft:   (id: number)    => Promise<void>
        confirmDrafts: (ids: number[]) => Promise<number[]>
        importConfirm: (data: any[])   => Promise<Sale[]>
      }
      stock: {
        getMovements: (ingredientId?: number) => Promise<StockMovement[]>
        adjust:       (data: { ingredientId: number; quantity: number; note?: string }) => Promise<StockMovement>
      }
      production: {
        getAll:  ()           => Promise<Production[]>
        create:  (data: any)  => Promise<Production>
        delete:  (id: number) => Promise<void>
      }
      purchaseRequests: {
        getAll:       ()           => Promise<PurchaseRequest[]>
        create:       (data: any)  => Promise<PurchaseRequest>
        updateStatus: (data: any)  => Promise<PurchaseRequest>
        delete:       (id: number) => Promise<void>
      }
      branches: {
        getAll:  ()           => Promise<Branch[]>
        create:  (data: any)  => Promise<Branch>
        update:  (data: any)  => Promise<Branch>
        delete:  (id: number) => Promise<void>
      }
      warehouses: {
        init:       ()           => Promise<Warehouse>
        getAll:     ()           => Promise<Warehouse[]>
        create:     (data: any)  => Promise<Warehouse>
        update:     (data: any)  => Promise<Warehouse>
        delete:     (id: number) => Promise<void>
        setDefault: (id: number) => Promise<Warehouse>
        syncStock:  (id: number) => Promise<WarehouseStock[]>
      }
      transferRequests: {
        getAll:       ()           => Promise<TransferRequest[]>
        create:       (data: any)  => Promise<TransferRequest>
        updateStatus: (data: any)  => Promise<TransferRequest>
        delete:       (id: number) => Promise<void>
      }
      transfers: {
        getAll:       ()           => Promise<Transfer[]>
        execute:      (id: number) => Promise<Transfer>
        createDirect: (data: any)  => Promise<Transfer>
        delete:       (id: number) => Promise<void>
      }
      inventory: {
        getAll:     ()                                                          => Promise<InventoryCount[]>
        create:     ()                                                          => Promise<InventoryCount>
        addItems:   (data: { countId: number; ingredientIds: number[] })       => Promise<InventoryCount>
        removeItem: (id: number)                                               => Promise<void>
        updateItem: (data: { id: number; actualQuantity: number })             => Promise<InventoryCountItem>
        close:      (id: number)                                               => Promise<InventoryCount>
        delete:     (id: number)                                               => Promise<void>
      }
      reports: {
        dashboard:       ()                                    => Promise<DashboardData>
        consumption:     (params: { from: string; to: string }) => Promise<any[]>
        productCosts:    ()                                    => Promise<any[]>
        incomeStatement: (params: { from: string; to: string }) => Promise<any>
        trialBalance:    (params?: { from?: string; to?: string }) => Promise<any>
        balanceSheet:    (params?: { asOf?: string })          => Promise<any>
        cashFlow:        (params?: { from?: string; to?: string }) => Promise<any>
        supplierDebt:    ()                                    => Promise<any>
      }
      auth: {
        listUsers: () => Promise<{ id: number; name: string; role: string }[]>
        login:     (userId: number, pin: string) => Promise<User | null>
        getAll:    () => Promise<User[]>
        create:    (data: any) => Promise<User>
        update:    (data: any) => Promise<User>
        delete:    (id: number) => Promise<void>
      }
      roles: {
        getAll:  () => Promise<Role[]>
        create:  (data: any) => Promise<Role>
        update:  (data: any) => Promise<Role>
        delete:  (id: number) => Promise<void>
      }
      settings: {
        getAll: () => Promise<AppSettings>
        set:    (key: string, value: string) => Promise<{ key: string; value: string }>
      }
      activity: {
        log:    (data: any) => Promise<ActivityLog>
        getAll: () => Promise<ActivityLog[]>
      }
      stock_waste: {
        create: (data: { ingredientId: number; quantity: number; note?: string }) => Promise<StockMovement>
        getAll: () => Promise<StockMovement[]>
      }
      backup: {
        create:       () => Promise<string | null>
        selectFolder: () => Promise<string | null>
        restore:      () => Promise<string | null>
      }
      customers: {
        getAll:    (includeInactive?: boolean) => Promise<Customer[]>
        create:    (data: any)                 => Promise<Customer>
        update:    (data: any)                 => Promise<Customer>
        delete:    (id: number)                => Promise<void>
        addPoints: (data: { id: number; points: number }) => Promise<Customer>
      }
      reservations: {
        getAll:       (params?: { from?: string; to?: string; status?: string }) => Promise<Reservation[]>
        create:       (data: any)                => Promise<Reservation>
        update:       (data: any)                => Promise<Reservation>
        updateStatus: (data: { id: number; status: string }) => Promise<Reservation>
        delete:       (id: number)               => Promise<void>
      }
      pos: {
        createOrder: (data: any)       => Promise<PosOrder>
        getOrders:   (limit?: number)  => Promise<PosOrder[]>
        voidOrder:   (id: number)      => Promise<PosOrder>
      }
      overhead: {
        getAll:  ()           => Promise<OverheadEntry[]>
        create:  (data: any)  => Promise<OverheadEntry>
        update:  (data: any)  => Promise<OverheadEntry>
        toggle:  (id: number) => Promise<OverheadEntry>
        delete:  (id: number) => Promise<void>
      }
      expenses: {
        getAll:  (params?: { from?: string; to?: string }) => Promise<Expense[]>
        create:  (data: any)  => Promise<Expense>
        update:  (data: any)  => Promise<Expense>
        delete:  (id: number) => Promise<void>
      }
      accounts: {
        getAll:      ()                           => Promise<ChartOfAccount[]>
        create:      (data: any)                  => Promise<ChartOfAccount>
        update:      (data: any)                  => Promise<ChartOfAccount>
        delete:      (id: number)                 => Promise<void>
        seed:        ()                           => Promise<{ seeded: boolean; count?: number }>
        getNextCode: (parentCode: string | null)  => Promise<string>
      }
      banks: {
        getAll:            ()           => Promise<BankAccount[]>
        create:            (data: any)  => Promise<BankAccount>
        update:            (data: any)  => Promise<BankAccount>
        delete:            (id: number) => Promise<void>
        getTransactions:   (id: number) => Promise<BankTransaction[]>
        addTransaction:    (data: any)  => Promise<BankTransaction>
        deleteTransaction: (id: number) => Promise<void>
      }
      journals: {
        getAll:  (params?: { from?: string; to?: string }) => Promise<JournalEntry[]>
        create:  (data: any)  => Promise<JournalEntry>
        delete:  (id: number) => Promise<void>
      }
      delivery: {
        getAll:      ()            => Promise<DeliveryPartner[]>
        create:      (data: any)   => Promise<DeliveryPartner>
        update:      (data: any)   => Promise<DeliveryPartner>
        toggle:      (id: number)  => Promise<DeliveryPartner>
        delete:      (id: number)  => Promise<void>
        getPrices:   (partnerId: number) => Promise<DeliveryProductPrice[]>
        setPrice:    (data: { partnerId: number; productId: number; price: number }) => Promise<DeliveryProductPrice>
        removePrice: (data: { partnerId: number; productId: number }) => Promise<void>
      }
    }
  }
}

export {}

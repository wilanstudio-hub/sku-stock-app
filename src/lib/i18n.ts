export type Lang = "th" | "en";

export const translations = {
  th: {
    // app
    appSubtitle: "ระบบเช็คสต๊อก",
    signIn: "เข้าสู่ระบบ",
    signOut: "ออกจากระบบ",
    adminPanel: "จัดการสิทธิ์",

    // tabs
    tabArt: "Art / อาร์ต",
    tabWd: "WD",
    tabEquipment: "Equipment / อุปกรณ์",

    // access
    pleaseSignIn: "กรุณาเข้าสู่ระบบเพื่อดูข้อมูล",
    noSections: "ยังไม่ได้รับสิทธิ์เข้าถึง section ใด",
    contactAdmin: "กรุณาติดต่อ Admin เพื่อขอสิทธิ์",

    // common
    cancel: "ยกเลิก",
    save: "บันทึก",
    delete: "ลบ",
    close: "ปิด",
    confirm: "ยืนยัน",
    loading: "กำลังโหลด...",
    noItems: "ไม่พบรายการ",
    back: "กลับ",

    // SkuTable toolbar
    itemsLabel: "รายการ",
    totalQtyLabel: "รวม",
    searchPlaceholder: "ค้นหา SKU, ชื่อ, หมวด, ที่เก็บ...",
    allCategories: "ทุกหมวด",
    historyBtn: "ประวัติ",
    addSkuBtn: "เพิ่ม SKU",
    syncSheetsBtn: "Sync Sheets",
    dryRunBtn: "Dry-run",
    printLabelsBtn: "Print labels",

    // SkuTable bulk actions
    selectedCount: (n: number) => `เลือกแล้ว ${n} รายการ`,
    clearSelection: "ล้าง",
    exportPdf: "Export PDF",
    printPdf: "พิมพ์",
    deleteSelected: "ลบที่เลือก",

    // SkuTable columns
    imageCol: "รูป",
    nameCol: "ชื่อ",
    categoryCol: "หมวด",
    locationCol: "ที่เก็บ",
    qtyCol: "จำนวน",
    statusCol: "สถานะ",
    actionsCol: "การกระทำ",

    // Availability badges
    inStock: "ในสตอค",
    onEvent: "ออกงาน",
    unavailable: "ไม่อยู่",

    // Delete confirm
    deleteSkuTitle: "ลบรายการ?",
    deleteSkuDesc: "การลบไม่สามารถย้อนกลับได้",
    deleteSelected_n: (n: number) => `ลบ ${n} รายการ?`,
    deleteAll: "ลบทั้งหมด",
    cannotUndone: "การลบไม่สามารถย้อนกลับได้",

    // SkuDialog
    addSkuTitle: "เพิ่ม SKU",
    editSkuTitle: "แก้ไข SKU",
    categoryLabel: "หมวดหมู่",
    selectCategory: "เลือกหมวดหมู่...",
    colorLabel: "สี",
    selectColor: "เลือกสี...",
    styleLabel: "สไตล์",
    selectStyle: "เลือกสไตล์...",
    statusLabel: "สถานะ",
    skuCodeLabel: "รหัส SKU",
    skuCodeHint: "(auto: DEPT-CAT-COLOR-STYLE-### — แก้ไขได้)",
    nameTh: "ชื่อภาษาไทย *",
    nameEn: "ชื่อภาษาอังกฤษ *",
    qtyLabel: "จำนวน",
    unitLabel: "หน่วย",
    unitPlaceholder: "ชิ้น / pcs",
    minStockLabel: "Min stock",
    locationLabel: "ที่เก็บ",
    specialFeaturesLabel: "ลักษณะพิเศษ",
    specialFeaturesPlaceholder: "เช่น ขนาด, วัสดุ, รายละเอียดพิเศษ",
    imagesLabel: "รูปภาพ",
    imagesHint: "(สูงสุด 5 รูป — รูปแรก = cover)",
    notesTh: "หมายเหตุ (ไทย)",
    notesEn: "หมายเหตุ (อังกฤษ)",

    // Status values
    statusAvailable: "อยู่ในสตอค",
    statusOnEvent: "อยู่ระหว่างออกงาน",
    statusUnavailable: "ไม่อยู่",

    // Auth
    signInTab: "เข้าสู่ระบบ",
    signUpTab: "สมัครสมาชิก",
    emailLabel: "Email",
    passwordLabel: "รหัสผ่าน",
    displayNameLabel: "ชื่อที่แสดง",
    departmentLabel: "แผนก",
    signInBtn: "เข้าสู่ระบบ",
    signUpBtn: "สมัครสมาชิก",
    forgotPassword: "ลืมรหัสผ่าน?",
    forgotPasswordAlert: "กรุณาติดต่อผู้ดูแลระบบ",
    forgotPasswordTitle: "ลืมรหัสผ่าน",
    forgotPasswordDesc: "ป้อนอีเมลของคุณ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้",
    sendResetLink: "ส่งลิงก์รีเซ็ต",
    resetEmailSent: "ส่งลิงก์รีเซ็ตแล้ว — กรุณาตรวจสอบอีเมลของคุณ",
    resetLineSentNote: "แจ้งเตือนผ่าน LINE แล้วด้วย",
    backToSignIn: "กลับไปเข้าสู่ระบบ",
    updatePasswordTitle: "ตั้งรหัสผ่านใหม่",
    newPasswordLabel: "รหัสผ่านใหม่",
    confirmPasswordLabel: "ยืนยันรหัสผ่านใหม่",
    updatePasswordBtn: "บันทึกรหัสผ่าน",
    passwordUpdated: "เปลี่ยนรหัสผ่านแล้ว",
    passwordMismatch: "รหัสผ่านไม่ตรงกัน",
    invalidResetLink: "ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุ",
    firstUserAdmin: "ผู้ใช้คนแรกจะเป็น Admin",
    accountCreated: "สร้างบัญชีแล้ว กรุณา Sign In",
    signedIn: "เข้าสู่ระบบสำเร็จ",

    // Admin page
    adminTitle: "Admin — จัดการสิทธิ์ผู้ใช้",
    legendRoles: "Roles (สิทธิ์แก้ไข)",
    legendViewAccess: "Section Access (สำหรับ viewer)",
    legendViewDesc: "User ที่มีแค่ viewer role จะเห็นเฉพาะ section ที่ติ๊กเปิดไว้",
    usersTitle: (n: number) => `ผู้ใช้ทั้งหมด (${n})`,
    noUsers: "ยังไม่มีผู้ใช้",
    noRoles: "ไม่มี role",
    rolesSection: "Roles",
    viewAccessSection: "Section ที่ดูได้ (view only)",
    noAccessWarning: "⚠ ไม่ได้รับสิทธิ์ section ใดเลย — จะไม่เห็นข้อมูลใดๆ",
    roleDescAdmin: "เข้าได้ทุก section + จัดการสิทธิ์",
    roleDescArt: "เข้าและแก้ไข Art",
    roleDescWd: "เข้าและแก้ไข WD",
    roleDescEquipment: "เข้าและแก้ไข Equipment",
    roleDescViewer: "ดูอย่างเดียว เฉพาะ section ที่กำหนด",

    // Sync
    syncingMsg: "กำลังดึงข้อมูลจาก Google Sheets...",
    syncSuccess: (ins: number, upd: number) => `Sync สำเร็จ: เพิ่มใหม่ ${ins}, อัปเดต ${upd}`,
    syncFailed: (msg: string) => `Sync ล้มเหลว: ${msg}`,
    dryRunFailed: (msg: string) => `Dry-run ล้มเหลว: ${msg}`,
    needPermission: "ต้องมีสิทธิ์ในแผนกนี้ หรือ admin",
    needDeptPermission: (d: string) => `ต้องมีสิทธิ์ ${d.toUpperCase()} หรือ admin`,
    needSignIn: "กรุณาเข้าสู่ระบบ",

    // SyncStatus
    neverSynced: "ยังไม่เคย sync จาก Google Sheets",
    lastSync: "Sync ล่าสุด",
    categoriesChanged: "หมวดที่อัปเดต",
    justNow: "เมื่อสักครู่",
    minutesAgo: (m: number) => `${m} นาทีก่อน`,
    hoursAgo: (h: number) => `${h} ชม. ก่อน`,
    daysAgo: (d: number) => `${d} วันก่อน`,
    newBadge: "ใหม่",
    updatedBadge: "อัปเดต",

    // SyncHistory
    syncHistoryTitle: "ประวัติการ Sync",
    syncHistoryDesc: "แสดง 50 ครั้งล่าสุด",
    noSyncHistory: "ยังไม่มีประวัติการ sync",
    categoriesSection: "หมวดที่อัปเดต",
    noChanges: "ไม่มีการเปลี่ยนแปลง",

    // DryRun
    dryRunTitle: "ผลทดสอบ Dry-run",
    dryRunDesc: "จำลองผลลัพธ์โดยไม่บันทึกลงฐานข้อมูล",
    dryRunNew: (n: number) => `+${n} จะเพิ่มใหม่`,
    dryRunUpdate: (n: number) => `~${n} จะอัปเดต`,
    dryRunPerCategory: "สรุปต่อหมวด",
    dryRunNoChanges: "ไม่มีหมวดที่เปลี่ยนแปลง",
    dryRunRunning: "กำลังประมวลผล...",
    runRealSync: "ยืนยัน Sync จริง",

    // Image upload
    compressing: "กำลังบีบอัดและอัปโหลด...",
    autoCompress: "ย่ออัตโนมัติ ≤50 KB · 800px",
    reduced: "ลดลง",
    maxImages: (n: number) => `สูงสุด ${n} รูป`,
    uploadingMulti: "กำลังบีบอัดและอัปโหลด...",
    coverHint: "คลิก ⭐ เพื่อตั้งเป็น cover",
    signInToUpload: "กรุณาเข้าสู่ระบบก่อนอัปโหลด",
    uploadedMsg: (n: number) => `อัปโหลด ${n} รูปแล้ว`,
    uploadedSingle: (kb: number) => `อัปโหลดแล้ว`,
    compressionInfo: (before: number, after: number) => `${before} KB → ${after} KB`,

    // QR
    labelSaved: "บันทึก label แล้ว",
    labelSaveFailed: "ไม่สามารถสร้างรูปภาพได้",

    // image buttons
    chooseImage: "เลือกรูป",
    camera: "ถ่ายรูป",
    remove: "ลบ",
    setAsCover: "ตั้งเป็น cover",
    imagesCount: (n: number, max: number) => `${n}/${max} รูป`,
    imagesWord: "รูป",

    // PDF
    pdfTitle: (dept: string) => `รายการ SKU - แผนก ${dept}`,
    pdfMeta: (n: number, date: string) => `จำนวน: ${n} รายการ   วันที่: ${date}`,
    pdfPage: (cur: number, total: number) => `หน้า ${cur} / ${total}`,
    pdfColumns: ["รูป", "SKU", "ชื่อ (TH)", "หมวดหมู่", "ที่เก็บ", "จำนวน", "สถานะ"] as string[],
    pdfAvailable: "ในสตอค",
    pdfOnEvent: "ออกงาน",
    pdfUnavailable: "ไม่อยู่",

    // Toast
    deleted: "ลบแล้ว",
    deletedN: (n: number) => `ลบ ${n} รายการแล้ว`,
    savedSuccess: "บันทึกแล้ว",
    exportFailed: (msg: string) => `Export ล้มเหลว: ${msg}`,
    pdfDownloaded: "ดาวน์โหลด PDF แล้ว",
    pdfOpened: "เปิด PDF เพื่อพิมพ์",
    roleAdded: (r: string) => `เพิ่ม ${r} แล้ว`,
    roleRemoved: "ลบแล้ว",
    cannotRemoveLastRole: "ไม่สามารถลบ role สุดท้ายได้",
    grantedAccess: (d: string) => `ให้สิทธิ์ดู ${d} แล้ว`,
    revokedAccess: (d: string) => `ถอนสิทธิ์ ${d} แล้ว`,
  },

  en: {
    // app
    appSubtitle: "Stock Checker",
    signIn: "Sign In",
    signOut: "Sign Out",
    adminPanel: "Permissions",

    // tabs
    tabArt: "Art",
    tabWd: "WD",
    tabEquipment: "Equipment",

    // access
    pleaseSignIn: "Please sign in to view data",
    noSections: "No sections have been assigned to you",
    contactAdmin: "Please contact an Admin to request access",

    // common
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    close: "Close",
    confirm: "Confirm",
    loading: "Loading...",
    noItems: "No items",
    back: "Back",

    // SkuTable toolbar
    itemsLabel: "Items",
    totalQtyLabel: "Total qty",
    searchPlaceholder: "Search SKU, name, category, location...",
    allCategories: "All categories",
    historyBtn: "History",
    addSkuBtn: "Add SKU",
    syncSheetsBtn: "Sync Sheets",
    dryRunBtn: "Dry-run",
    printLabelsBtn: "Print labels",

    // SkuTable bulk actions
    selectedCount: (n: number) => `${n} selected`,
    clearSelection: "Clear",
    exportPdf: "Export PDF",
    printPdf: "Print",
    deleteSelected: "Delete selected",

    // SkuTable columns
    imageCol: "Image",
    nameCol: "Name",
    categoryCol: "Category",
    locationCol: "Location",
    qtyCol: "Qty",
    statusCol: "Status",
    actionsCol: "Actions",

    // Availability badges
    inStock: "In stock",
    onEvent: "On event",
    unavailable: "Unavailable",

    // Delete confirm
    deleteSkuTitle: "Delete this SKU?",
    deleteSkuDesc: "This cannot be undone.",
    deleteSelected_n: (n: number) => `Delete ${n} SKUs?`,
    deleteAll: "Delete all",
    cannotUndone: "This cannot be undone.",

    // SkuDialog
    addSkuTitle: "Add SKU",
    editSkuTitle: "Edit SKU",
    categoryLabel: "Category",
    selectCategory: "Select category...",
    colorLabel: "Color",
    selectColor: "Select color...",
    styleLabel: "Style",
    selectStyle: "Select style...",
    statusLabel: "Status",
    skuCodeLabel: "SKU Code",
    skuCodeHint: "(auto: DEPT-CAT-COLOR-STYLE-### — editable)",
    nameTh: "Name (Thai) *",
    nameEn: "Name (English) *",
    qtyLabel: "Qty",
    unitLabel: "Unit",
    unitPlaceholder: "pcs",
    minStockLabel: "Min stock",
    locationLabel: "Location",
    specialFeaturesLabel: "Special features",
    specialFeaturesPlaceholder: "e.g. size, material, notable details",
    imagesLabel: "Images",
    imagesHint: "(max 5 — first image = cover)",
    notesTh: "Notes (Thai)",
    notesEn: "Notes (English)",

    // Status values
    statusAvailable: "In stock",
    statusOnEvent: "On event",
    statusUnavailable: "Unavailable",

    // Auth
    signInTab: "Sign In",
    signUpTab: "Sign Up",
    emailLabel: "Email",
    passwordLabel: "Password",
    displayNameLabel: "Display name",
    departmentLabel: "Department",
    signInBtn: "Sign In",
    signUpBtn: "Create account",
    forgotPassword: "Forgot password?",
    forgotPasswordAlert: "Please contact your system administrator",
    forgotPasswordTitle: "Forgot password",
    forgotPasswordDesc: "Enter your email and we'll send you a reset link",
    sendResetLink: "Send reset link",
    resetEmailSent: "Reset link sent — please check your email",
    resetLineSentNote: "Notification also sent via LINE",
    backToSignIn: "Back to sign in",
    updatePasswordTitle: "Set new password",
    newPasswordLabel: "New password",
    confirmPasswordLabel: "Confirm new password",
    updatePasswordBtn: "Save password",
    passwordUpdated: "Password updated",
    passwordMismatch: "Passwords do not match",
    invalidResetLink: "Invalid or expired reset link",
    firstUserAdmin: "First user becomes admin",
    accountCreated: "Account created — please sign in",
    signedIn: "Signed in successfully",

    // Admin page
    adminTitle: "Admin — User Permissions",
    legendRoles: "Roles (edit access)",
    legendViewAccess: "Section Access (viewers only)",
    legendViewDesc: "Users with only the viewer role can only see sections that are checked",
    usersTitle: (n: number) => `All Users (${n})`,
    noUsers: "No users yet",
    noRoles: "No roles",
    rolesSection: "Roles",
    viewAccessSection: "View access (read-only)",
    noAccessWarning: "⚠ No sections assigned — user cannot see any data",
    roleDescAdmin: "Full access + manage permissions",
    roleDescArt: "View & edit Art",
    roleDescWd: "View & edit WD",
    roleDescEquipment: "View & edit Equipment",
    roleDescViewer: "Read-only, specific sections only",

    // Sync
    syncingMsg: "Fetching data from Google Sheets...",
    syncSuccess: (ins: number, upd: number) => `Sync complete: ${ins} new, ${upd} updated`,
    syncFailed: (msg: string) => `Sync failed: ${msg}`,
    dryRunFailed: (msg: string) => `Dry-run failed: ${msg}`,
    needPermission: "Need this department or admin role",
    needDeptPermission: (d: string) => `Need ${d.toUpperCase()} or admin role`,
    needSignIn: "Please sign in first",

    // SyncStatus
    neverSynced: "Never synced from Google Sheets",
    lastSync: "Last sync",
    categoriesChanged: "Categories changed",
    justNow: "just now",
    minutesAgo: (m: number) => `${m}m ago`,
    hoursAgo: (h: number) => `${h}h ago`,
    daysAgo: (d: number) => `${d}d ago`,
    newBadge: "new",
    updatedBadge: "updated",

    // SyncHistory
    syncHistoryTitle: "Sync History",
    syncHistoryDesc: "Showing last 50 sync runs",
    noSyncHistory: "No sync history yet",
    categoriesSection: "Categories updated",
    noChanges: "No changes",

    // DryRun
    dryRunTitle: "Dry-run Preview",
    dryRunDesc: "Simulated — nothing was written to the database",
    dryRunNew: (n: number) => `+${n} new`,
    dryRunUpdate: (n: number) => `~${n} updates`,
    dryRunPerCategory: "Per category",
    dryRunNoChanges: "No changes",
    dryRunRunning: "Running...",
    runRealSync: "Run real sync",

    // Image upload
    compressing: "Compressing & uploading...",
    autoCompress: "Auto-compress ≤50 KB · 800px",
    reduced: "reduced",
    maxImages: (n: number) => `Max ${n} images`,
    uploadingMulti: "Compressing & uploading...",
    coverHint: "Click ⭐ to set as cover",
    signInToUpload: "Please sign in to upload",
    uploadedMsg: (n: number) => `Uploaded ${n} image${n > 1 ? "s" : ""}`,
    uploadedSingle: (kb: number) => `Uploaded`,
    compressionInfo: (before: number, after: number) => `${before} KB → ${after} KB`,

    // QR
    labelSaved: "Label saved",
    labelSaveFailed: "Could not generate image",

    // image buttons
    chooseImage: "Choose",
    camera: "Camera",
    remove: "Remove",
    setAsCover: "Set as cover",
    imagesCount: (n: number, max: number) => `${n}/${max} images`,
    imagesWord: "images",

    // PDF
    pdfTitle: (dept: string) => `SKU List - Department ${dept}`,
    pdfMeta: (n: number, date: string) => `Items: ${n}   Date: ${date}`,
    pdfPage: (cur: number, total: number) => `Page ${cur} / ${total}`,
    pdfColumns: ["Image", "SKU", "Name (TH)", "Category", "Location", "Qty", "Status"] as string[],
    pdfAvailable: "In stock",
    pdfOnEvent: "On event",
    pdfUnavailable: "Unavailable",

    // Toast
    deleted: "Deleted",
    deletedN: (n: number) => `${n} items deleted`,
    savedSuccess: "Saved",
    exportFailed: (msg: string) => `Export failed: ${msg}`,
    pdfDownloaded: "PDF downloaded",
    pdfOpened: "Opening PDF for print",
    roleAdded: (r: string) => `${r} added`,
    roleRemoved: "Removed",
    cannotRemoveLastRole: "Cannot remove last role",
    grantedAccess: (d: string) => `${d} access granted`,
    revokedAccess: (d: string) => `${d} access revoked`,
  },
} as const;

export type TranslationKey = keyof typeof translations.th;

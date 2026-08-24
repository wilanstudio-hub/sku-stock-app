# FilmFlow-Inventory (SKU Stock App) Blueprint

**FilmFlow-Inventory** เป็นแอปพลิเคชันสำหรับจัดการคลังสินค้า (Inventory Management) และการเบิกจ่ายของในกองถ่ายภาพยนตร์หรือโปรดักชัน โดยมีการแบ่งหมวดหมู่ (เช่น ฝ่ายศิลป์ - Art, ฝ่ายเสื้อผ้า - Wardrobe) พร้อมระบบสแกนบาร์โค้ด/คิวอาร์โค้ด และมีระบบจัดการสิทธิ์ผู้ใช้งาน (Role-based Access Control)

## 1. Tech Stack (โครงสร้างเทคโนโลยี)

### Frontend (หน้าบ้าน)
* **Core:** React 18, TypeScript, Vite
* **Styling & UI:** Tailwind CSS, Shadcn UI (Radix UI components), Lucide React (สำหรับไอคอน)
* **Routing:** React Router DOM
* **State & Data Fetching:** TanStack React Query สำหรับจัดการ API Cache และ State
* **Forms & Validation:** React Hook Form + Zod
* **Features:** 
  * รองรับหลายภาษา (`LangProvider`)
  * ปรับขนาดฟอนต์ (`FontSizeProvider`)
  * กราฟสถิติ (`Recharts`)

### Backend & Database (หลังบ้าน)
* **Core:** Supabase
* **Database:** PostgreSQL
* **Authentication:** Supabase Auth (รองรับ Email/Password และการเชื่อมต่อ LINE)
* **Security:** Row Level Security (RLS) ควบคุมการเข้าถึงข้อมูลระดับแถวตามสิทธิ์ผู้ใช้งาน

---

## 2. Core Database Schema (โครงสร้างฐานข้อมูลหลัก)

ฐานข้อมูลใช้ PostgreSQL บน Supabase โดยมีตารางที่สำคัญดังนี้:

* **`profiles`**: เก็บข้อมูลผู้ใช้งานเพิ่มเติมที่ผูกกับ `auth.users`
  * ข้อมูล: `display_name` (ชื่อแสดงผล), `department` (แผนก), `line_user_id` (สำหรับแจ้งเตือนหรือล็อกอินผ่าน LINE)
* **`user_roles`**: จัดการสิทธิ์การใช้งาน (RBAC) โดยแบ่งเป็น
  * `admin` (แอดมิน)
  * `art` (ฝ่ายศิลป์)
  * `wd` (ฝ่ายเสื้อผ้า)
  * `viewer` (ผู้เยี่ยมชม/ดูได้อย่างเดียว)
* **`skus`**: ตารางหลักที่ใช้เก็บข้อมูลสินค้า/อุปกรณ์ ประกอบด้วย:
  * `sku_code` (รหัสสินค้า)
  * `department` (แผนกที่ดูแล เช่น art, wd)
  * `name_th`, `name_en` (ชื่อภาษาไทยและอังกฤษ)
  * `category`, `location` (หมวดหมู่และสถานที่จัดเก็บ)
  * `quantity`, `unit`, `min_stock` (จำนวนปัจจุบัน, หน่วย, และจุดสั่งซื้อ/สต๊อกขั้นต่ำ)
  * `image_url` (รูปภาพสินค้า)
* **`checkout_tracking`**: ใช้สำหรับติดตามประวัติการเบิก-จ่าย หรือยืม-คืนของ
* **`sync_logs` / `sheets_registry`**: ระบบซิงค์ข้อมูลหรือสำรองข้อมูล (Export) ออกไปยัง Google Sheets หรือระบบภายนอก

---

## 3. Pages & Features (โครงสร้างหน้าจอและฟีเจอร์หลัก)

* **Dashboard/Inventory (`/`)**
  * หน้ารายการสินค้า แสดงสต๊อกปัจจุบัน
  * สามารถกรอง (Filter) ตามแผนก, หมวดหมู่, หรือค้นหาด้วยชื่อ/SKU
* **Scan System (`/scan`)**
  * รองรับการสแกน Barcode หรือ QR Code เพื่อค้นหาสินค้าอย่างรวดเร็ว (สำหรับการนับสต๊อก หรือการเบิกจ่าย)
* **Admin Dashboard (`/admin`)**
  * สำหรับแอดมินในการจัดการสิทธิ์ผู้ใช้งาน (เปลี่ยน Role ให้คนอื่น) และตั้งค่าแผนก (Dynamic Departments)
* **Authentication (`/auth`, `/update-password`)**
  * ระบบล็อกอินและอัปเดตรหัสผ่าน
* **Context Providers (ระบบบริบท)**
  * `AuthProvider`: จัดการสถานะการล็อกอิน
  * `LangProvider`: รองรับการสลับภาษา (ไทย-อังกฤษ)
  * `FontSizeProvider`: รองรับการปรับขนาดตัวอักษรเพื่อ Accessibility

---

**สรุป:** เป็นแอป Smart Inventory ที่เน้นความรวดเร็วในการใช้งานผ่านมือถือ/แท็บเล็ต (มีระบบสแกน) ออกแบบมาให้ทำงานร่วมกันหลายแผนกในโปรเจกต์เดียวกัน โดยข้อมูลจะถูกแยกและป้องกันไม่ให้แผนกอื่นแก้ไขได้ (ผ่าน RLS ของ Supabase) ยกเว้น Admin

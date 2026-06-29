# NEGOCIO SAAS — Documentación Técnica v1.0

## Descripción

Sistema SaaS Multi-Tenant para gestión de negocios. Una sola plataforma que sirve a miles de empresas con aislamiento total de datos mediante Row Level Security (RLS) en PostgreSQL/Supabase.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15, React 19, TypeScript |
| Estilos | Tailwind CSS, Shadcn UI, Framer Motion |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Hosting | Vercel (frontend) + Supabase Cloud (backend) |
| Control de versiones | GitHub |

---

## Estructura de Carpetas

```
negocio-saas/
├── src/
│   ├── app/
│   │   ├── (auth)/               # Rutas públicas
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── reset-password/
│   │   ├── (super-admin)/        # Panel Super Administrador
│   │   │   ├── dashboard/
│   │   │   ├── empresas/
│   │   │   ├── planes/
│   │   │   ├── pagos/
│   │   │   └── usuarios/
│   │   └── (empresa)/            # Panel de Empresa (tenant)
│   │       ├── dashboard/
│   │       ├── pedidos/
│   │       ├── productos/
│   │       ├── clientes/
│   │       ├── gastos/
│   │       ├── inventario/
│   │       ├── reportes/
│   │       └── configuracion/
│   ├── components/
│   │   ├── ui/                   # Componentes base (Shadcn)
│   │   ├── super-admin/          # Componentes del super admin
│   │   ├── empresa/              # Componentes del panel empresa
│   │   ├── pedidos/              # Formularios de pedidos
│   │   └── shared/               # Componentes compartidos
│   └── lib/
│       ├── supabase/             # Cliente y helpers de Supabase
│       ├── hooks/                # Custom hooks React
│       ├── utils/                # Funciones utilitarias
│       └── types/                # Tipos TypeScript
├── supabase/
│   ├── migrations/               # Scripts SQL ordenados
│   ├── functions/                # Edge Functions
│   └── policies/                 # Políticas RLS
└── docs/                         # Esta documentación
```

---

## Modelo de Datos

### Relaciones principales

```
planes (1) ──── (N) empresas
empresas (1) ─── (N) usuarios
empresas (1) ─── (N) categorias
empresas (1) ─── (N) productos
empresas (1) ─── (N) clientes
empresas (1) ─── (N) pedidos
pedidos (1) ──── (N) pedido_items
pedido_items (N) ─── (1) productos
empresas (1) ─── (N) gastos
empresas (1) ─── (N) licencias
empresas (1) ─── (N) pagos
productos (1) ── (N) inventario_movimientos
```

### Tabla `empresas` (Tenant raíz)
Cada empresa es un tenant. **Toda tabla operativa lleva `empresa_id`** para el aislamiento.

### Seguridad Multi-Tenant
1. **RLS habilitado** en todas las tablas
2. **`get_empresa_id()`** — función que retorna el `empresa_id` del usuario autenticado
3. **Políticas automáticas**: cada query filtra por `empresa_id = get_empresa_id()`
4. **Super Admin** tiene políticas especiales que bypasean el filtro de empresa
5. **Nunca** se puede acceder a datos de otra empresa

---

## Variables de Entorno

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key  # solo en servidor
```

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/negocio-saas.git
cd negocio-saas

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Ejecutar migraciones en Supabase
# En el dashboard de Supabase > SQL Editor:
# Copiar y ejecutar: supabase/migrations/001_schema_inicial.sql
# Luego: supabase/policies/rls_policies.sql

# 5. Iniciar servidor de desarrollo
npm run dev
```

---

## Despliegue en Producción

### Supabase
1. Crear proyecto en supabase.com
2. Ejecutar los scripts SQL en el SQL Editor
3. Configurar Storage bucket `logos` (público) y `comprobantes` (privado)
4. Habilitar Auth providers (Email/Password)

### Vercel
```bash
# Conectar repositorio en vercel.com
# Agregar variables de entorno en el dashboard
# Deploy automático en cada push a main
vercel --prod
```

---

## Roles y Permisos

| Acción | Super Admin | Admin Empresa | Empleado |
|--------|:-----------:|:-------------:|:--------:|
| Ver todas las empresas | ✓ | — | — |
| Gestionar planes | ✓ | — | — |
| Ingresar como empresa | ✓ | — | — |
| Crear usuarios de empresa | ✓ | ✓ | — |
| Gestionar productos | ✓ | ✓ | según permisos |
| Registrar pedidos | ✓ | ✓ | ✓ |
| Ver reportes | ✓ | ✓ | según permisos |
| Configurar empresa | ✓ | ✓ | — |

---

## Flujo de Pedido Rápido (< 30 segundos)

1. Abrir `/pedidos/nuevo`
2. Escribir nombre/teléfono del cliente → seleccionar de sugerencias (o crear nuevo)
3. Buscar productos → agregar con un clic
4. Ajustar cantidades con +/-
5. Ingresar descuento y delivery si aplica
6. Seleccionar método de pago
7. Click en "Registrar pedido"

El stock se descuenta automáticamente vía trigger en PostgreSQL.

---

## Funcionalidades Preparadas para Futuro

El esquema y la arquitectura están preparados para agregar:

- **Facturación electrónica (SUNAT)**: integración con OSE via Edge Functions
- **WhatsApp Business API**: notificaciones de pedido al cliente
- **POS físico**: módulo de caja y cierre diario
- **Sucursales**: campo `sucursal_id` en tablas operativas
- **API REST pública**: documentada con OpenAPI para integraciones
- **IA de análisis**: vistas agregadas listas para conectar con modelos de ML
- **App móvil**: la API de Supabase es compatible con React Native directamente

---

## Consideraciones de Rendimiento

- Todos los campos de búsqueda frecuente tienen índices (`empresa_id`, `estado`, `fecha`, `telefono`)
- Vistas materializadas para dashboards de alto tráfico (futuro)
- Paginación con cursor en listados
- Imágenes en Supabase Storage con CDN global
- Realtime habilitado solo para pedidos activos (reduce carga)

---

## Seguridad

- JWT con expiración configurable (por defecto 1 hora)
- Refresh tokens para sesiones largas
- RLS previene acceso cruzado entre empresas a nivel de base de datos
- Service Role Key nunca expuesta al cliente (solo en Edge Functions)
- Auditoría de cambios críticos en tabla `auditoria`
- Soft delete en todas las entidades principales
- Prepared para 2FA (Supabase Auth lo soporta con TOTP)

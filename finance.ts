generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  CLIENT
}

enum RequestStatus {
  PENDENTE
  APROVADO
  RECUSADO
}

enum AgreementStatus {
  ABERTO
  PAGO
  ATRASADO
  CANCELADO
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         Role
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  client       Client?
}

model Client {
  id         String      @id @default(cuid())
  name       String
  document   String?
  phone      String?
  email      String      @unique
  active     Boolean     @default(true)
  userId     String      @unique
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  requests   Request[]
  agreements Agreement[]
}

model Request {
  id          String        @id @default(cuid())
  clientId    String
  amount      Decimal       @db.Decimal(14, 2)
  observation String?
  status      RequestStatus @default(PENDENTE)
  approvedAt  DateTime?
  refusedAt   DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  client      Client        @relation(fields: [clientId], references: [id], onDelete: Cascade)
  agreement   Agreement?
}

model Agreement {
  id                     String          @id @default(cuid())
  clientId               String
  requestId              String?         @unique
  originalValue          Decimal         @db.Decimal(14, 2)
  openAmount             Decimal         @db.Decimal(14, 2)
  installmentsCount      Int
  interestRate           Decimal         @db.Decimal(10, 4)
  installmentValue       Decimal         @db.Decimal(14, 2)
  totalFinal             Decimal         @db.Decimal(14, 2)
  agreementDate          DateTime        @default(now())
  dueDate                DateTime
  status                 AgreementStatus @default(ABERTO)
  observations           String?
  dailyInterestRate      Decimal?        @db.Decimal(10, 4)
  dailyInterestStartedAt DateTime?
  createdAt              DateTime        @default(now())
  updatedAt              DateTime        @updatedAt
  client                 Client          @relation(fields: [clientId], references: [id], onDelete: Cascade)
  request                Request?        @relation(fields: [requestId], references: [id], onDelete: SetNull)
  installments           Installment[]
  dailyInterestLogs      DailyInterestLog[]
}

model Installment {
  id             String    @id @default(cuid())
  agreementId    String
  number         Int
  dueDate        DateTime
  paymentValue   Decimal   @db.Decimal(14, 2)
  interestValue  Decimal   @db.Decimal(14, 2)
  amortization   Decimal   @db.Decimal(14, 2)
  remainingValue Decimal   @db.Decimal(14, 2)
  paid           Boolean   @default(false)
  paidAt         DateTime?
  createdAt      DateTime  @default(now())
  agreement      Agreement @relation(fields: [agreementId], references: [id], onDelete: Cascade)

  @@unique([agreementId, number])
}

model DailyInterestLog {
  id            String    @id @default(cuid())
  agreementId   String
  baseOpenAmount Decimal   @db.Decimal(14, 2)
  dailyRate     Decimal   @db.Decimal(10, 4)
  daysCount     Int
  updatedAmount Decimal   @db.Decimal(14, 2)
  createdAt     DateTime  @default(now())
  agreement     Agreement @relation(fields: [agreementId], references: [id], onDelete: Cascade)
}

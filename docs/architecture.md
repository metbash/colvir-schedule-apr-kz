# Архитектура проекта

## Структура

```
src/

core/
calendar/
models/
processors/
interest/
engine/
apr/
ui/
styles/
utils/
```

---

## Слои

UI

↓

ScheduleEngine

↓

Processors

↓

Core

---

## ScheduleEngine

Единственная точка построения графика.

Самостоятельно не выполняет вычисления.

Передает управление процессорам.

---

## Processors

Каждый процессор отвечает только за одну задачу.

InterestProcessor

GraceProcessor

RateProcessor

ManualProcessor

RedistributionProcessor

BalanceProcessor

APRProcessor

---

## Core

Не содержит банковской логики.

Только:

- даты
- деньги
- округления
- константы
- перечисления

---

## Models

Loan

LoanState

PaymentRow

GraceEvent

RateChangeEvent

ManualEvent

EarlyRepaymentEvent

---

## Правила разработки

Каждый файл должен:

- компилироваться
- быть полностью закончен
- не содержать TODO
- не содержать заглушек
- использовать только существующие импорты

После каждого этапа проект должен запускаться.
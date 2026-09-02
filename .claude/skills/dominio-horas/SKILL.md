---
name: dominio-horas
description: Reglas de negocio de turnos, inscripciones y cálculo de avance de horas en registro-horas-vr. Cárgala antes de tocar las tablas registros/inscripciones o cualquier lógica que sume o valide horas — es la diferencia entre horas bien contadas y un becario con avance incorrecto.
---

# Dominio de horas — registro-horas-vr

## La relación que sostiene el esquema

Un becario puede repetir semestre de servicio. Por eso **las horas cuelgan de
`inscripcion_id`, nunca directo de `becario_id`.** Una inscripción es la relación entre un
becario y un semestre concreto (`unique(becario_id, semestre_id)`), y cada inscripción tiene su
propia `horas_meta`. Si algún código nuevo suma o filtra horas por `becario_id` sin pasar por la
inscripción, va a mezclar horas de dos periodos distintos del mismo becario — es el bug más caro
posible en este dominio porque es silencioso: la suma da un número, solo que el número está mal.

```
becario ──< inscripciones >── semestre
                │
                └──< registros
```

## Qué hace válido un turno (`registros`)

- `hora_fin > hora_inicio`, forzado por `CHECK` en la base — pero valida también en el cliente
  antes del insert, para dar el error de inmediato en vez de esperar el rechazo de Postgres.
- **Los turnos que cruzan medianoche no son representables** (la resta de `time` no lo permite).
  Es una decisión aceptada porque el laboratorio de VR cierra de noche. Si algún día se necesita
  un turno nocturno, es un cambio de tipo de columna (`time` → `timestamptz`) y de la constraint,
  no un parche puntual — consultarlo antes, no improvisar una excepción.
- `minutos` es una columna generada (`stored`) a partir de `hora_fin - hora_inicio`. **Nunca la
  calcules de nuevo en el cliente ni la mandes en el insert** — si el cliente y la base calculan
  distinto, quedan datos inconsistentes. Léela, no la reproduzcas.
- `fecha` no debería quedar muy en el futuro — hay (o debe haber) un `CHECK` laxo para esto;
  no es una regla estricta de negocio, solo evita errores de captura obvios.

## Cálculo de avance

El avance de un becario en un semestre es `sum(minutos) / 60` de sus `registros`, vía
`inscripcion_id`, contra la `horas_meta` de esa inscripción. Este cálculo debe vivir en **una
sola vista o función de Postgres** (`avance_becarios` o equivalente) — el frontend la consulta,
nunca reimplementa el `sum` ni el `join` a mano. Si necesitás un dato derivado nuevo (por
ejemplo "% completado"), agregalo a esa vista, no calcules el porcentaje de forma distinta en
cada pantalla que lo muestre.

Campos esperados de esa vista, como mínimo: `inscripcion_id`, `becario_id`, `semestre_id`,
`minutos_acumulados`, `horas_meta`, `horas_faltantes`, `porcentaje`.

## Qué revisar en una PR

1. ¿Algún insert/update a `registros` referencia `becario_id` en vez de `inscripcion_id`? →
   hallazgo de gravedad alta.
2. ¿Se valida `hora_fin > hora_inicio` en el cliente además de confiar en el `CHECK` de la base?
   Si falta la validación de cliente, es gravedad baja (la base igual lo rechaza) pero repórtalo
   — mejora la UX del error.
3. ¿Algún código calcula `minutos` o el avance por su cuenta en vez de usar la columna generada
   o la vista existente? → hallazgo de gravedad alta: es la causa más probable de horas mal
   contadas.
4. ¿Una nueva inscripción olvida el `unique(becario_id, semestre_id)` o permite duplicar la
   inscripción de un becario en el mismo semestre? → hallazgo.
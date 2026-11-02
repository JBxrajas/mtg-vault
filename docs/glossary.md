# Glosario

## MTG
- **Oracle card:** la carta como concepto, independiente de la edición (mismo nombre y texto).
- **Printing (impresión):** una versión concreta de una carta en una edición, con su número de colección, arte y precio.
- **Set (edición):** conjunto de cartas publicado junto, identificado por un código (por ejemplo `mh3`).
- **Collector number:** número de la carta dentro de su edición.
- **Foil:** acabado brillante; tiene precio distinto.
- **Condición:** estado físico: NM (casi nueva), LP, MP, HP, DMG.
- **Formato:** reglas de construcción de mazo (Standard, Modern, Commander, …).

## Modelo de datos (borrador)
- `set` — edición.
- `card` — oracle card.
- `printing` — impresión; pertenece a una `card` y a un `set`.
- `collection_entry` — una entrada de la colección de un usuario: `printing`, cantidad, foil, condición, idioma, precio de compra.
- `deck` y `deck_entry` — mazos.
- `price_snapshot` — precio de una `printing` en una fecha.

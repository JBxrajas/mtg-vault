# APIs y fuentes de datos externas

## Scryfall (fuente principal)
- Docs: https://scryfall.com/docs/api
- Gratuita. Exige cabeceras `User-Agent` y `Accept` en cada petición.
- Límite de cortesía: 50–100 ms entre peticiones (unas 10 por segundo como máximo).
- **Bulk data** (`/bulk-data`): archivos JSON con todo el catálogo, se actualizan periódicamente. Usar `default_cards` (una entrada por impresión) o `oracle_cards` (una por carta). Importar el bulk en vez de consultar carta por carta.
- Precios (`prices.usd`, `usd_foil`, `eur`, `eur_foil`, `tix`): solo el valor actual, **sin histórico**. Los datos de precio se actualizan una vez al día, así que el snapshot diario basta.
- Búsqueda difusa por nombre: `/cards/named?fuzzy=` (útil para el resultado del OCR).
- Imágenes: campo `image_uris` (hay versiones `small`, `normal`, `large`, `png`, `art_crop`).

## MTGJSON
- https://mtgjson.com
- Gratuita. Incluye precios históricos de varios proveedores (Cardmarket, TCGplayer, …). Complemento para rellenar histórico.

## Precios de mercado
- **TCGplayer:** ya no concede acceso nuevo a su API.
- **Cardmarket:** requiere solicitar acceso.
- Empezamos con los precios de Scryfall y MTGJSON.

## Escaneo de cartas
No existe una API que lo resuelva. Se construye en el cliente combinando:
1. OCR (Tesseract.js) del nombre y del número de colección, y búsqueda difusa en Scryfall.
2. Hash perceptual (pHash) de la imagen contra las imágenes de Scryfall, para distinguir ediciones.
OpenCV.js para el recorte y la corrección de perspectiva.

## Moxfield
API no oficial; no depender de ella. Soportar solo el formato de importación y exportación CSV.

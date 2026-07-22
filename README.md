# Costa Blanca · Itinerario 12–16 de agosto

Web interactiva del viaje de 4 personas por Alicante y la Costa Blanca (radio 100 km): calas, motos de agua, senderismo en el Peñón de Ifach, kayak, rafting y una noche de fiesta en Benidorm.

## Qué incluye

- **`index.html`** — página principal con los 5 días y 3 opciones por día en tarjetas.
- **17 páginas de detalle** en `planes/`, cada una con **mini galería de fotos** (clic para ampliar) — una por plan, con horario hora a hora, consejos, dónde comprar entradas/reservar y logística (cómo llegar y qué llevar).
- **Resumen interactivo** — al pulsar «Elegir este plan» en cualquier página, la elección se guarda en el navegador y aparece en la sección «Vuestro plan» de la portada.

## Estructura

```
costa-blanca-web/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── main.js
└── planes/
    ├── dia1-calas.html      dia1-sup.html        dia1-relax.html
    ├── dia2-motos.html      dia2-kayak.html      dia2-combo.html
    ├── dia3-granadella.html dia3-kayak-cuevas.html dia3-calpe.html
    ├── dia3-calas-salvajes.html
    ├── dia4-rafting.html    dia4-aqualandia.html dia4-algar.html     dia4-levante.html
    └── dia5-barco.html      dia5-kayak.html      dia5-chill.html
```

## Cómo publicarlo en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `costa-blanca`).
2. Sube todo el contenido de la carpeta `costa-blanca-web/` a la raíz del repo
   (arrastrando los archivos en la web de GitHub, o con `git`).
3. En el repo: **Settings → Pages → Source: Deploy from a branch → `main` / `root`**.
4. En un par de minutos estará en `https://TU-USUARIO.github.io/costa-blanca/`.

No hay que instalar nada ni compilar: es HTML, CSS y JavaScript puro.

## Ver en local

Abre `index.html` en el navegador directamente, o levanta un servidor simple:

```bash
python3 -m http.server 8000
# luego abre http://localhost:8000
```

## Notas

- **Fotos:** las galerías usan imágenes de Google Maps servidas en remoto. Necesitan conexión a internet para verse y se cargan al abrir cada plan. Si quisieras hacerlas locales, descárgalas y cámbialas por rutas `assets/img/...`.

- Precios orientativos (verano 2025-2026); confirmar al reservar.
- El registro para subir a la cima del Peñón de Ifach es **gratuito y obligatorio**,
  se solicita la víspera en `parquesnaturales.gva.es`.
- Fuentes de datos de sitios y valoraciones: Google Maps / Places.

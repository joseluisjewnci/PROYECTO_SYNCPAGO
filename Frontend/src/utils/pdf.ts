// Generador de PDF sin dependencias: dibuja un título, un resumen y una tabla que continúa en varias páginas.
// Usa las fuentes estándar Helvetica y Helvetica-Bold (vienen en todo lector de PDF, no se incrustan).
export interface ColumnaPdf {
  titulo: string;
  ancho: number; // en puntos (1 punto = 1/72 de pulgada); la suma debe caber en 515
  alinear?: "izq" | "der";
}

// Imagen que se repite en el centro de CADA página, semitransparente y por encima del contenido.
export interface MarcaAguaPdf {
  ancho: number; // píxeles de la imagen
  alto: number;
  jpeg: Uint8Array; // colores (JPEG)
  alfa: Uint8Array; // transparencia por píxel (8 bits, comprimida con zlib)
  anchoEnPagina: number; // ancho en puntos dentro de la página (el alto sale de la proporción)
  opacidad: number; // 0 a 1
}

export interface DocumentoPdf {
  titulo: string;
  encabezado: string[]; // líneas bajo el título (usuario, filtros, fecha)
  resumen: string[]; // líneas del recuadro de resumen
  columnas: ColumnaPdf[];
  filas: string[][];
  vacio: string; // texto cuando no hay filas
  pie: string;
  marcaAgua?: MarcaAguaPdf;
}

const ANCHO_PAGINA = 595; // A4 vertical
const ALTO_PAGINA = 842;
const MARGEN = 40;
const ALTO_FILA = 20;
const PIE_RESERVA = 50;
const AZUL = "0.208 0.388 0.914";
const GRIS_CLARO = "0.953 0.957 0.969";

// Anchos de Helvetica (por cada 1000 unidades) de los caracteres ASCII 32 a 126; sirven para alinear y recortar texto.
const ANCHOS: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

// Convierte el texto a caracteres de un byte (WinAnsi/Latin-1) para que tildes y ñ se vean bien.
function aLatin1(texto: string): string {
  const limpio = String(texto ?? "").replace(/[\s  ]+/g, " ");
  let salida = "";
  for (const c of limpio) {
    let codigo = c.charCodeAt(0);
    if (codigo === 0x2013 || codigo === 0x2014) codigo = 45;
    else if (codigo === 0x201c || codigo === 0x201d) codigo = 34;
    else if (codigo === 0x2018 || codigo === 0x2019) codigo = 39;
    else if (codigo > 255) {
      const base = c.normalize("NFD").charCodeAt(0);
      codigo = base <= 126 ? base : 63; // si no se puede representar, se pone "?"
    }
    if (codigo < 32 || (codigo >= 127 && codigo <= 159)) codigo = 63;
    salida += String.fromCharCode(codigo);
  }
  return salida;
}

function anchoCaracter(codigo: number): number {
  if (codigo >= 32 && codigo <= 126) return ANCHOS[codigo - 32];
  const base = String.fromCharCode(codigo).normalize("NFD").charCodeAt(0); // é -> e
  return base >= 32 && base <= 126 ? ANCHOS[base - 32] : 556;
}

function anchoTexto(latin1: string, tamano: number, negrita: boolean): number {
  let suma = 0;
  for (let i = 0; i < latin1.length; i++) suma += anchoCaracter(latin1.charCodeAt(i));
  return (suma / 1000) * tamano * (negrita ? 1.07 : 1);
}

function recortar(latin1: string, maximo: number, tamano: number, negrita: boolean): string {
  if (anchoTexto(latin1, tamano, negrita) <= maximo) return latin1;
  let texto = latin1;
  while (texto.length > 1 && anchoTexto(texto + "...", tamano, negrita) > maximo) texto = texto.slice(0, -1);
  return texto + "...";
}

function escapar(latin1: string): string {
  return latin1.replace(/[\\()]/g, (c) => "\\" + c);
}

// Convierte bytes a un texto de un carácter por byte (así se arma el archivo sin mezclar codificaciones).
function bytesATexto(bytes: Uint8Array): string {
  let salida = "";
  for (let i = 0; i < bytes.length; i += 8192) salida += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return salida;
}

function num(n: number): string {
  return n.toFixed(2);
}

// Una operación de texto: (x, y) es la esquina inferior izquierda de la línea base.
function texto(t: string, x: number, y: number, tamano: number, negrita: boolean, color: string): string {
  return "BT " + color + " rg /" + (negrita ? "F2" : "F1") + " " + tamano + " Tf " + num(x) + " " + num(y) + " Td (" + escapar(t) + ") Tj ET\n";
}

function rectangulo(x: number, y: number, ancho: number, alto: number, color: string): string {
  return color + " rg " + num(x) + " " + num(y) + " " + num(ancho) + " " + num(alto) + " re f\n";
}

export function generarPdf(doc: DocumentoPdf): Uint8Array {
  const NEGRO = "0.1 0.1 0.1";
  const GRIS = "0.4 0.4 0.45";
  const anchoTabla = doc.columnas.reduce((s, c) => s + c.ancho, 0);
  const paginas: string[] = [];
  let contenido = "";
  let y = ALTO_PAGINA - MARGEN;

  function filaDeEncabezado(): void {
    contenido += rectangulo(MARGEN, y - ALTO_FILA + 5, anchoTabla, ALTO_FILA, AZUL);
    let x = MARGEN;
    for (const col of doc.columnas) {
      const t = recortar(aLatin1(col.titulo), col.ancho - 12, 9.5, true);
      const xt = col.alinear === "der" ? x + col.ancho - 6 - anchoTexto(t, 9.5, true) : x + 6;
      contenido += texto(t, xt, y - 9, 9.5, true, "1 1 1");
      x += col.ancho;
    }
    y -= ALTO_FILA;
  }

  function nuevaPagina(): void {
    if (contenido) paginas.push(contenido);
    contenido = "";
    y = ALTO_PAGINA - MARGEN;
    contenido += texto(recortar(aLatin1(doc.titulo + " (continuación)"), anchoTabla, 11, true), MARGEN, y - 10, 11, true, GRIS);
    y -= 30;
    filaDeEncabezado();
  }

  // Primera página: título, encabezado y resumen
  contenido += texto(recortar(aLatin1(doc.titulo), anchoTabla, 20, true), MARGEN, y - 18, 20, true, AZUL);
  y -= 34;
  for (const linea of doc.encabezado) {
    contenido += texto(recortar(aLatin1(linea), anchoTabla, 10, false), MARGEN, y - 10, 10, false, GRIS);
    y -= 15;
  }
  y -= 6;
  if (doc.resumen.length > 0) {
    const alto = doc.resumen.length * 16 + 12;
    contenido += rectangulo(MARGEN, y - alto + 6, anchoTabla, alto, GRIS_CLARO);
    let yr = y - 8;
    for (const linea of doc.resumen) {
      contenido += texto(recortar(aLatin1(linea), anchoTabla - 20, 10, false), MARGEN + 10, yr - 8, 10, false, NEGRO);
      yr -= 16;
    }
    y -= alto + 10;
  }
  filaDeEncabezado();

  if (doc.filas.length === 0) {
    contenido += texto(aLatin1(doc.vacio), MARGEN + 6, y - 14, 10, false, GRIS);
  }
  doc.filas.forEach((fila, i) => {
    if (y - ALTO_FILA < PIE_RESERVA) nuevaPagina();
    if (i % 2 === 1) contenido += rectangulo(MARGEN, y - ALTO_FILA + 5, anchoTabla, ALTO_FILA, GRIS_CLARO);
    let x = MARGEN;
    doc.columnas.forEach((col, j) => {
      const t = recortar(aLatin1(fila[j] ?? ""), col.ancho - 12, 9.5, false);
      const xt = col.alinear === "der" ? x + col.ancho - 6 - anchoTexto(t, 9.5, false) : x + 6;
      contenido += texto(t, xt, y - 9, 9.5, false, NEGRO);
      x += col.ancho;
    });
    y -= ALTO_FILA;
  });
  paginas.push(contenido);

  // Pie de página con numeración (se conoce el total solo al final)
  const total = paginas.length;
  const marca = doc.marcaAgua;
  const anchoMarca = marca ? marca.anchoEnPagina : 0;
  const altoMarca = marca ? (marca.anchoEnPagina * marca.alto) / marca.ancho : 0;
  // Va al final de cada página para quedar por encima de las filas; con la opacidad baja el texto sigue legible, centrada en la página
  const operacionMarca = marca ? "q /GS1 gs " + num(anchoMarca) + " 0 0 " + num(altoMarca) + " " + num((ANCHO_PAGINA - anchoMarca) / 2) + " " + num((ALTO_PAGINA - altoMarca) / 2) + " cm /Logo Do Q\n" : "";
  const paginasFinales = paginas.map((c, i) => {
    const num_ = "Página " + (i + 1) + " de " + total;
    return c + operacionMarca + texto(recortar(aLatin1(doc.pie), 380, 8.5, false), MARGEN, 30, 8.5, false, GRIS) + texto(aLatin1(num_), ANCHO_PAGINA - MARGEN - anchoTexto(aLatin1(num_), 8.5, false), 30, 8.5, false, GRIS);
  });

  // Estructura del archivo: 1 catálogo, 2 páginas, 3 y 4 fuentes, luego (página, contenido) por cada página
  const objetos: string[] = [];
  const primeraPagina = marca ? 7 : 5; // 5 y 6 los usa la imagen de la marca de agua
  const idPagina = (i: number): number => primeraPagina + i * 2;
  objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = "<< /Type /Pages /Count " + total + " /Kids [" + paginasFinales.map((_, i) => idPagina(i) + " 0 R").join(" ") + "] >>";
  objetos[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objetos[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  if (marca) {
    const alfaTexto = bytesATexto(marca.alfa);
    const jpegTexto = bytesATexto(marca.jpeg);
    objetos[5] = "<< /Type /XObject /Subtype /Image /Width " + marca.ancho + " /Height " + marca.alto + " /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length " + alfaTexto.length + " >>\nstream\n" + alfaTexto + "\nendstream";
    objetos[6] = "<< /Type /XObject /Subtype /Image /Width " + marca.ancho + " /Height " + marca.alto + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /SMask 5 0 R /Length " + jpegTexto.length + " >>\nstream\n" + jpegTexto + "\nendstream";
  }
  const recursos = "<< /Font << /F1 3 0 R /F2 4 0 R >>" + (marca ? " /XObject << /Logo 6 0 R >> /ExtGState << /GS1 << /Type /ExtGState /ca " + num(marca.opacidad) + " /CA " + num(marca.opacidad) + " >> >>" : "") + " >>";
  paginasFinales.forEach((c, i) => {
    objetos[idPagina(i)] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + ANCHO_PAGINA + " " + ALTO_PAGINA + "] /Resources " + recursos + " /Contents " + (idPagina(i) + 1) + " 0 R >>";
    objetos[idPagina(i) + 1] = "<< /Length " + c.length + " >>\nstream\n" + c + "endstream";
  });

  let salida = "%PDF-1.4\n%âãÏÓ\n";
  const posiciones: number[] = [];
  for (let id = 1; id < objetos.length; id++) {
    posiciones[id] = salida.length;
    salida += id + " 0 obj\n" + objetos[id] + "\nendobj\n";
  }
  const inicioXref = salida.length;
  salida += "xref\n0 " + objetos.length + "\n0000000000 65535 f \n";
  for (let id = 1; id < objetos.length; id++) salida += String(posiciones[id]).padStart(10, "0") + " 00000 n \n";
  salida += "trailer\n<< /Size " + objetos.length + " /Root 1 0 R >>\nstartxref\n" + inicioXref + "\n%%EOF\n";

  const bytes = new Uint8Array(salida.length);
  for (let i = 0; i < salida.length; i++) bytes[i] = salida.charCodeAt(i) & 255;
  return bytes;
}

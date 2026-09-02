// Parsea el CSV que el coordinador sube para dar de alta becarios en lote. Puro: no toca
// React ni Supabase, así que la vista previa que muestra la UI es literalmente lo que
// esta función devuelve — sin un segundo parser en el servidor que pueda discrepar.
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COLUMNAS_ESPERADAS = ['correo', 'nombre', 'matricula']

export interface FilaCsv {
  fila: number
  nombre: string
  matricula: string
  correo: string
  error?: string
}

export interface ParseCsvResultado {
  filas: FilaCsv[]
  error?: string
}

// Marcas diacríticas combinantes (rango Unicode U+0300-U+036F), armado con String.fromCharCode
// para no depender de cómo el editor o el filesystem preserven combining marks literales en
// el archivo fuente.
const MARCAS_DIACRITICAS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
)

function normalizarEncabezado(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(MARCAS_DIACRITICAS, '') // quita acentos: "matrícula" -> "matricula"
}

function detectarDelimitador(lineaEncabezado: string): ',' | ';' {
  const comas = (lineaEncabezado.match(/,/g) ?? []).length
  const puntoYComa = (lineaEncabezado.match(/;/g) ?? []).length
  // Excel en locale es-MX exporta CSV con ; como separador.
  return puntoYComa > comas ? ';' : ','
}

/** Tokenizador mínimo con soporte de comillas: separa una línea respetando "campos, con comas". */
function tokenizarLinea(linea: string, delimitador: string): string[] {
  const campos: string[] = []
  let actual = ''
  let dentroDeComillas = false

  for (let i = 0; i < linea.length; i++) {
    const char = linea[i]

    if (dentroDeComillas) {
      if (char === '"') {
        if (linea[i + 1] === '"') {
          actual += '"'
          i++
        } else {
          dentroDeComillas = false
        }
      } else {
        actual += char
      }
      continue
    }

    if (char === '"') {
      dentroDeComillas = true
    } else if (char === delimitador) {
      campos.push(actual)
      actual = ''
    } else {
      actual += char
    }
  }
  campos.push(actual)

  return campos.map((campo) => campo.trim())
}

export function parseCsvBecarios(textoOriginal: string): ParseCsvResultado {
  // Excel siempre escribe un BOM al inicio; sin quitarlo, el encabezado nunca matchea.
  const texto = textoOriginal.replace(/^﻿/, '')
  const lineas = texto.split(/\r?\n/).filter((linea) => linea.trim().length > 0)

  if (lineas.length === 0) {
    return { filas: [], error: 'El archivo está vacío.' }
  }

  const delimitador = detectarDelimitador(lineas[0])
  const encabezado = tokenizarLinea(lineas[0], delimitador).map(normalizarEncabezado)

  const indices = COLUMNAS_ESPERADAS.map((columna) => encabezado.indexOf(columna))
  if (indices.some((indice) => indice === -1)) {
    return {
      filas: [],
      error: 'El archivo debe tener las columnas correo, nombre y matricula (en cualquier orden).',
    }
  }
  const [indiceCorreo, indiceNombre, indiceMatricula] = indices

  const lineasDeDatos = lineas.slice(1)
  if (lineasDeDatos.length === 0) {
    return { filas: [], error: 'El archivo no tiene filas de datos, solo el encabezado.' }
  }

  const correosVistos = new Set<string>()

  const filas: FilaCsv[] = lineasDeDatos.map((linea, idx) => {
    const campos = tokenizarLinea(linea, delimitador)
    const fila = idx + 1
    const nombre = (campos[indiceNombre] ?? '').trim()
    const matricula = (campos[indiceMatricula] ?? '').trim()
    const correo = (campos[indiceCorreo] ?? '').trim().toLowerCase()

    if (!nombre || !matricula || !correo) {
      return { fila, nombre, matricula, correo, error: 'Faltan nombre, matrícula o correo.' }
    }

    if (!CORREO_REGEX.test(correo)) {
      return { fila, nombre, matricula, correo, error: 'El correo no tiene un formato válido.' }
    }

    if (correosVistos.has(correo)) {
      return { fila, nombre, matricula, correo, error: 'Correo repetido en el archivo.' }
    }
    correosVistos.add(correo)

    return { fila, nombre, matricula, correo }
  })

  return { filas }
}

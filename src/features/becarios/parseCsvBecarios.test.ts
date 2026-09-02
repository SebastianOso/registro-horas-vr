import { describe, expect, it } from 'vitest'
import { parseCsvBecarios } from './parseCsvBecarios'

describe('parseCsvBecarios', () => {
  it('parsea un CSV válido con encabezado en el orden correo, nombre, matricula', () => {
    const csv = 'correo,nombre,matricula\nana@x.mx,Ana López,A001\nluis@x.mx,Luis Paz,A002'
    const { filas, error } = parseCsvBecarios(csv)

    expect(error).toBeUndefined()
    expect(filas).toEqual([
      { fila: 1, nombre: 'Ana López', matricula: 'A001', correo: 'ana@x.mx' },
      { fila: 2, nombre: 'Luis Paz', matricula: 'A002', correo: 'luis@x.mx' },
    ])
  })

  it('acepta el encabezado en cualquier orden', () => {
    const csv = 'nombre,correo,matricula\nAna López,ana@x.mx,A001'
    const { filas, error } = parseCsvBecarios(csv)

    expect(error).toBeUndefined()
    expect(filas).toEqual([{ fila: 1, nombre: 'Ana López', matricula: 'A001', correo: 'ana@x.mx' }])
  })

  it('rechaza un encabezado que no tiene las tres columnas esperadas', () => {
    const csv = 'nombre,correo\nAna López,ana@x.mx'
    const { error, filas } = parseCsvBecarios(csv)

    expect(filas).toEqual([])
    expect(error).toContain('correo, nombre y matricula')
  })

  it('quita el BOM inicial que escribe Excel', () => {
    const csv = '﻿correo,nombre,matricula\nana@x.mx,Ana,A001'
    const { filas, error } = parseCsvBecarios(csv)

    expect(error).toBeUndefined()
    expect(filas).toHaveLength(1)
  })

  it('detecta el punto y coma como delimitador (Excel es-MX)', () => {
    const csv = 'correo;nombre;matricula\nana@x.mx;Ana López;A001'
    const { filas, error } = parseCsvBecarios(csv)

    expect(error).toBeUndefined()
    expect(filas).toEqual([{ fila: 1, nombre: 'Ana López', matricula: 'A001', correo: 'ana@x.mx' }])
  })

  it('respeta comillas con una coma adentro del campo', () => {
    const csv = 'correo,nombre,matricula\nana@x.mx,"Pérez Gómez, Ana",A001'
    const { filas } = parseCsvBecarios(csv)

    expect(filas).toEqual([{ fila: 1, nombre: 'Pérez Gómez, Ana', matricula: 'A001', correo: 'ana@x.mx' }])
  })

  it('acepta matrícula acentuada en el encabezado', () => {
    const csv = 'correo,nombre,matrícula\nana@x.mx,Ana,A001'
    const { error, filas } = parseCsvBecarios(csv)

    expect(error).toBeUndefined()
    expect(filas).toHaveLength(1)
  })

  it('maneja finales de línea \\r\\n', () => {
    const csv = 'correo,nombre,matricula\r\nana@x.mx,Ana,A001\r\nluis@x.mx,Luis,A002'
    const { filas } = parseCsvBecarios(csv)

    expect(filas).toHaveLength(2)
  })

  it('descarta líneas vacías', () => {
    const csv = 'correo,nombre,matricula\n\nana@x.mx,Ana,A001\n\n'
    const { filas } = parseCsvBecarios(csv)

    expect(filas).toHaveLength(1)
  })

  it('marca un correo con formato inválido como error de fila sin abortar el archivo', () => {
    const csv = 'correo,nombre,matricula\nno-es-un-correo,Ana,A001\nluis@x.mx,Luis,A002'
    const { filas } = parseCsvBecarios(csv)

    expect(filas[0].error).toBe('El correo no tiene un formato válido.')
    expect(filas[1].error).toBeUndefined()
  })

  it('marca un correo repetido dentro del archivo como error de fila', () => {
    const csv = 'correo,nombre,matricula\nana@x.mx,Ana,A001\nana@x.mx,Ana Otra Vez,A002'
    const { filas } = parseCsvBecarios(csv)

    expect(filas[0].error).toBeUndefined()
    expect(filas[1].error).toBe('Correo repetido en el archivo.')
  })

  it('marca una fila con un campo vacío como error', () => {
    const csv = 'correo,nombre,matricula\nana@x.mx,,A001'
    const { filas } = parseCsvBecarios(csv)

    expect(filas[0].error).toBe('Faltan nombre, matrícula o correo.')
  })

  it('reporta error de archivo cuando no hay filas de datos', () => {
    const csv = 'correo,nombre,matricula'
    const { filas, error } = parseCsvBecarios(csv)

    expect(filas).toEqual([])
    expect(error).toContain('solo el encabezado')
  })

  it('reporta error de archivo cuando el texto está vacío', () => {
    const { filas, error } = parseCsvBecarios('')

    expect(filas).toEqual([])
    expect(error).toBe('El archivo está vacío.')
  })
})

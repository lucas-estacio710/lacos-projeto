export const parseValorBR = (valorStr: string | number): number => {
  if (!valorStr) return 0
  
  let valor = valorStr.toString().trim()
  valor = valor.replace(/R\$|RS/gi, '')
  valor = valor.replace(/\s+/g, '')
  
  const isNegative = valor.includes('(') || valor.includes(')') || valor.startsWith('-')
  valor = valor.replace(/[\(\)\-\+]/g, '')
  
  if (valor.includes(',')) {
    if (valor.includes('.') && valor.lastIndexOf('.') < valor.lastIndexOf(',')) {
      valor = valor.replace(/\./g, '').replace(',', '.')
    } else {
      valor = valor.replace(',', '.')
    }
  }
  
  const numericValue = parseFloat(valor) || 0
  return isNegative ? -numericValue : numericValue
}

export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export const formatMonth = (mes: string): string => {
  if (!mes || mes === 'todos') return 'Todos os meses'
  const year = '20' + mes.substring(0, 2)
  const month = mes.substring(2, 4)
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return monthNames[parseInt(month) - 1] + ' ' + year
}

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  if (dateStr.includes('/')) return dateStr
  if (dateStr.length === 8) {
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    return `${day}/${month}/${year}`
  }
  return dateStr
}

export const generateInterID = (data: string, descricao: string, valor: number): string => {
  const dateStr = data.replace(/\D/g, '')
  const descClean = descricao.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
  const valorInt = Math.abs(Math.round(valor * 100))
  return `INT${dateStr}${descClean}${valorInt.toString().padStart(6, '0')}`
}

export const generateBBID = (data: string, descricao: string, valor: number): string => {
  const dateStr = data.replace(/\D/g, '')
  const descClean = descricao.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
  const valorInt = Math.abs(Math.round(valor * 100))
  return `BB${dateStr}${descClean}${valorInt.toString().padStart(6, '0')}`
}

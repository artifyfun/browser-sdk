const fs = require('fs')
const path = require('path')

const files = fs.readdirSync('./node_modules/@datadog', { recursive: true })

const distPath = './dist/@datadog'

try {
  fs.rmSync(distPath, { recursive: true })
} catch (e) {
  console.log('No such directory: ' + distPath + ', skip it.')
}

for (let file of files) {
  const targetPath = `${distPath}/${file}`
  const filePath = fs.readlinkSync(`./node_modules/@datadog/${file}`).replace('../../', './')
  try {
    fs.cpSync(filePath, targetPath, { recursive: true })
  } catch (error) {
    console.log(error)
  }
}


console.log('copy successfully!')

const GOTO_PAGE_ON_LOAD = undefined
 
const focusSection = id => {
    document.querySelector('section.active-section').classList.remove('active-section')
    document.querySelector('section#' + id).classList.add('active-section')
}

async function main() {
    if (window.self === window.top) {
        focusSection('external-page')
        return
    }

    await replit.init({ permissions: [] })

    const replDb = replit.replDb
    const fs = replit.fs

    window.addEventListener('hashchange', () => {
        focusSection(window.location.hash.substring(1))
    })

    if (GOTO_PAGE_ON_LOAD) {
        focusSection(GOTO_PAGE_ON_LOAD)
    } else {
        focusSection('import-export-selection')
    }

    const replDbToObject = async (callback) => {
        const resultObject = {}
        const list = await replDb.list({prefix: ''}) || []

        let amountAddedToObjectCount = 0
        
         for (const key of list.keys) {
            const itemFromDb = await replDb.get({key: key})
             
            try {
                resultObject[key] = JSON.parse(itemFromDb)
            } catch (error) {
                if (error.name === 'SyntaxError') {
                    resultObject[key] = itemFromDb
                } else {
                    callback(amountAddedToObjectCount, list.keys.length, new Error('Unable to parse replDb into object.'))
                }
            }
             
            amountAddedToObjectCount++
            callback(amountAddedToObjectCount, list.keys.length)
        }

        return resultObject
    }

    const updateProgressBar = (progressInfoName, value) => {
        document.querySelector(`#${progressInfoName} > progress`).value = value
    }

    const updateProgressStatus = (progressInfoName, text) => {
        document.querySelector(`#${progressInfoName} > p.status-message`).innerText = text
    }

    const toggleFormElements = () => {
        for (const child of document.querySelector('#export-form').children) child.disabled = !child.disabled
    }
    
    document.querySelector('#export-button').addEventListener('click', async event => {
        updateProgressStatus('export-progress-info', 'Exporting your ReplDb...')
        updateProgressBar('export-progress-info', 0)
        document.querySelector('#export-progress-info').hidden = false
        toggleFormElements()
        
        const fileName = document.querySelector('#file-name')
        const fileType = document.querySelector('#file-type')
        const beautifyCheckbox = document.querySelector('#beautify-output-checkbox')

        if (/\s+/.test(fileName.value) || fileName.value === '') fileName.value = `repldb-export-${Date.now()}`

        const dbObject = await replDbToObject((keysAddedAmount, totalKeysAmount, error) => {
            if (error) {
                console.log(error)
                toggleFormElements()
                return
            }
            
            updateProgressBar('export-progress-info', (keysAddedAmount / totalKeysAmount) * 100)
        })
        
        let contentToWrite = ''

        switch (fileType.value) {
            case 'json': {
                contentToWrite = beautifyCheckbox.checked ? JSON.stringify(dbObject, null, 4) : JSON.stringify(dbObject)
                break
            }
        }

        fs.writeFile(`${fileName.value}.${fileType.value}`, contentToWrite).then(result => {
            if (result.error) {
                // handle error here
                console.log(error)
                return
            }

            updateProgressStatus('export-progress-info', 'Succesfully exported your ReplDb!')
            toggleFormElements()
        })
    })

    const getImportableFiles = callback => {
        let results = []

        const iterateDirectory = async path => {
            const result = await fs.readDir(path)

            if (result.error) {
                // handle error here
                console.log(result.error)
                return
            }

            result.children.forEach(async (child, index) => {
                if (child.filename.startsWith('.')) return
                if (child.type === 'DIRECTORY') {
                    await iterateDirectory(`${path}${child.filename}/`)
                    return
                }

                if (/.*.(json)/.test(child.filename)) { 
                    if (path === './') {
                        results.push(`${path}${child.filename}`) 
                    } else {
                        results.push(`${path}${child.filename}/`)
                    }
                }

                if (index === result.children.length - 1) callback(results.map(file => file.slice(-1) === '/' ? file.slice(0, -1) : file))
            })
        }

        iterateDirectory('./')
    }

    document.querySelector("a[href='#import-page']").addEventListener('click', async event => {
        getImportableFiles(files => {
            const importableFilesList = document.querySelector('#importable-files-list')
            importableFilesList.innerHTML = ''

            const toggleFileListButtons = () => {
                for (const button of document.querySelectorAll('#importable-files-list button')) button.disabled = !button.disabled
            }
            
            for (const filePath of files) {
                const fileElementItem = document.createElement('li')
                const fileElementFilePath = document.createElement('span')
                const fileElementButton = document.createElement('button')

                fileElementFilePath.innerText = filePath
                fileElementButton.innerText = 'Import'

                fileElementButton.addEventListener('click', () => {
                    updateProgressStatus('import-progress-info', 'Importing your file...')
                    updateProgressBar('import-progress-info', 0)
                    document.querySelector('#import-progress-info').hidden = false
                    toggleFileListButtons()

                    const fileType = filePath.slice(filePath.lastIndexOf('.'), filePath.length).slice(1)
                    let importObject = {}
    
                    fs.readFile(filePath).then(async result => {
                        if (result.error) {
                            // handle error here
                            console.log(result.error)
                        }
                        
                        switch (fileType) {
                            case 'json': {
                                importObject = JSON.parse(result.content)
                                break
                            }
                        }

                        const importObjectKeys = Object.keys(importObject)
                        let amountAddedToReplDb = 0
                        
                        importObjectKeys.forEach((key, index) => {
                            isArrayOrObject = typeof importObject[key] === 'object' || typeof importObject[key] === 'array'
                            
                            replDb.set({ key: key, value: isArrayOrObject ? JSON.stringify(importObject[key]) : importObject[key]})
                                .then(() => {
                                    amountAddedToReplDb++ 
                                    updateProgressBar('import-progress-info', (amountAddedToReplDb / importObjectKeys.length) * 100)

                                    if (index === importObjectKeys.length - 1) {
                                        updateProgressStatus('import-progress-info', 'Succesfully imported your file!')
                                        toggleFileListButtons()
                                        return
                                    }
                                })
                                .catch(error => {
                                    toggleFileListButtons()
                                    // handle error here
                                    console.log(error)
                                })
                        })
                    })
                })

                fileElementItem.appendChild(fileElementFilePath)
                fileElementItem.appendChild(fileElementButton)
                importableFilesList.appendChild(fileElementItem)
            } 
        })
    })
}

main()
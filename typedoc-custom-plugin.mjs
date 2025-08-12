import { MarkdownPageEvent } from 'typedoc-plugin-markdown';

export function load(app) {
  app.renderer.postRenderAsyncJobs.push(async (renderer) => {
    const navigation = renderer.navigation

    // Add safety check for navigation
    if (!navigation || !Array.isArray(navigation)) {
      console.warn('Navigation is not available or not an array')
      return
    }

    // sort the Error classes to the end of the list
    const classesIndex = navigation.findIndex((item) => item.title === 'Classes')
    if (classesIndex !== -1 && navigation[classesIndex].children) {
      navigation[classesIndex].children.sort((a, b) => {
        const isErrorA = a.title.endsWith('Error')
        const isErrorB = b.title.endsWith('Error')
        if (isErrorA && !isErrorB) {
          return 1
        }
        if (!isErrorA && isErrorB) {
          return -1
        }
        return a.title.localeCompare(b.title)
      })
    }

    const resultArray = navigation.map((item) => ({
      group: item.title,
      pages: (item.children || []).map((child) => `v2/sdk-reference/${child.path?.replace('.mdx', '') || ''}`),
    }))

    // simply output to console, we then manually copy/paste into mint.json in Mintlify
    console.log(JSON.stringify(resultArray))
  })

  // this adds the title to top of every mdx file as Mintlify expects
  // @todo - add description to important SDK classes and set `description` here also
  app.renderer.on(MarkdownPageEvent.BEGIN, (page) => {
    page.frontmatter = {
      title: page.model?.name,
      ...page.frontmatter,
    }
  })

  app.renderer.on(MarkdownPageEvent.END, (page) => {
    // Add safety check for page.contents
    if (typeof page.contents === 'string') {
      // remove .mdx from links so it works with mintlify
      page.contents = page.contents.replace(/\.mdx/g, '')

      // add "./" to beginning of links so they open in same tab in mintlify
      page.contents = page.contents.replace(/\]\((?!http|\.{2}\/)/g, '](./')
    }
  })
}

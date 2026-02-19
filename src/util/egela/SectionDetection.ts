export function getSectionNumberFromUrl(url: string): number | undefined {
    try {
        const parsedUrl = new URL(url);
        const sectionParam = parsedUrl.searchParams.get("section");
        if (!sectionParam) return undefined;

        const sectionNumber = parseInt(sectionParam, 10);
        return Number.isNaN(sectionNumber) ? undefined : sectionNumber;
    } catch {
        return undefined;
    }
}

function getSectionNumberFromTabClass(className: string): number | undefined {
    const match = className.match(/tab_position_(\d+)/);
    if (!match) return undefined;
    const sectionNumber = parseInt(match[1], 10);
    return Number.isNaN(sectionNumber) ? undefined : sectionNumber;
}

function getSectionNumberFromAnchor(anchor: Element | null): number | undefined {
    if (!anchor) return undefined;

    const href = anchor.getAttribute("href");
    if (href) {
        const sectionFromHref = getSectionNumberFromUrl(href);
        if (sectionFromHref !== undefined) return sectionFromHref;
    }

    return undefined;
}

export function getSectionNumberFromCourseTabs(doc: Document): number | undefined {
    const currentTab = doc.querySelector("li.nav-item.actual");
    if (currentTab) {
        const sectionFromHref = getSectionNumberFromAnchor(currentTab.querySelector("a[href*='section=']"));
        if (sectionFromHref !== undefined) return sectionFromHref;

        const sectionFromClass = getSectionNumberFromTabClass(currentTab.className);
        if (sectionFromClass !== undefined) return sectionFromClass;
    }

    const activeTabLink = doc.querySelector("li.nav-item a.nav-link.active[href*='section=']");
    const sectionFromActiveLink = getSectionNumberFromAnchor(activeTabLink);
    if (sectionFromActiveLink !== undefined) return sectionFromActiveLink;

    return undefined;
}

export function detectCurrentCourseSectionNumber(url: string, doc: Document): number | undefined {
    const sectionFromUrl = getSectionNumberFromUrl(url);
    if (sectionFromUrl !== undefined) return sectionFromUrl;
    return getSectionNumberFromCourseTabs(doc);
}

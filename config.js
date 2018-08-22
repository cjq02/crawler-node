const url = 'http://w3.afulyu.pw';

const Config = {
    pageStart: 1,
    pageEnd: 50,
    pages: getPages.call(this),
    sleepMultiple: 3,
    fileName: 'CLUB2.html',
    uris: {
        list: `${url}/pw/thread.php?fid=3`,
        detail: `${url}/pw`
    },
    keyWords: {
        list: ["有", "中", "骑", "騎"],
        detail: ["CLUB"]
    },
    linksUri: `${url}/pw/thread.php?fid=3`,
    detailUri: `${url}/pw`
};

function getPages() {
    return function () {
        let pages = [];
        for (let i = this.pageStart; i <= this.pageEnd; i++) {
            pages.push(i);
        }

        return pages;
    }
}

export default Config;
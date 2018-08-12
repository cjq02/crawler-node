import Crawler from 'crawler';
import _ from 'lodash';
import fs from 'fs';
import {
    promisify
} from 'util';

import Constants from './constants';
import Config from './config';

class CrawlerApplication {

    constructor() {
        this.pages = Config.pages();
        this.uri = Config.linksUri;
        this.crawlerFactory = CrawlerFactory;
        this.crawlerLinks = new CrawlerLinks();
    }

    async start() {
        fs.createWriteStream(Config.fileName).write('');

        await Promise.all(this.pages.map(async (page) => {
            let res = await this.crawlerFactory.queue({
                uri: `${this.uri}&page=${page}`,
                page
            });

            this.crawlerLinks.handler(res);
        }));
    }
}

class CrawlerLinks {

    constructor() {
        this.constants = Constants;
        this.uri = Config.detailUri;
        this.crawlerDetail = new CrawlerDetail();
        this.crawlerFactory = CrawlerFactory;
        this.htmlBuilder = new CrawlerHtmlBuilder();
    }

    async handler(res) {
        let $ = res.$;

        if (_.isUndefined($)) {
            console.log(res.body + ' href: ' + res.options.uri);
            return;
        }

        let links = $('h3 a');

        let filterLinks = _.filter(links, link => this.hasKeyWordInLink($(link).text()));

        let list = filterLinks.map((link) => {
            return `${this.uri}/${link.attribs.href}`;
        });

        let opts = {
            list,
            page: res.options.page,
            linkCollection: [],
            handler: this.crawlerDetail.handler.bind(this.crawlerDetail)
        };

        let options = await this.crawlerFactory.queues(opts);
        this.drain(options);
    }

    async drain(options) {
        if (options.linkCollection.length === 0) {
            return;
        }

        let html = '';

        // html = this.htmlBuilder.buildTable(opts.linkCollection);

        _.each(options.linkCollection, (link) => {
            html += this.htmlBuilder.buildLink(link);
        });

        const appendFileSync = await promisify(fs.appendFileSync);
        appendFileSync(Config.fileName, html);

        console.log(`Print Page: ${options.page}`);
    }

    hasKeyWordInLink(linkText) {
        for (let keyWord of this.constants.linkKeyWords) {
            if (linkText.indexOf(keyWord) > 0) {
                return true;
            }
        }

        return false;
    }
}

class CrawlerDetail {

    constructor() {
        this.constants = Constants;
    }

    handler(res) {
        this.res = res;
        let $ = res.$;
        this.avNums = [];

        if (_.isUndefined($)) {
            console.log(res.body + ' href: ' + res.options.uri);
            return;
        }

        var keyWordsInDetail = _.filter(this.constants.detailKeyWords, (keyWord) => {
            let hasNum = res.body.indexOf(keyWord) > 0;

            if (hasNum) {
                this.getAvNums(keyWord);
            }

            return hasNum;
        });

        if (keyWordsInDetail.length > 0) {
            let link = {
                url: res.options.uri,
                text: $('#subject_tpc').text(),
                publishedTime: $(_.first($('.fl.gray'))).text().slice(4),
                keyWords: keyWordsInDetail,
                avNums: this.avNums
            };

            res.options.linkCollection.push(link);
        }
    }

    getAvNums(keyWord, preIndex) {
        let index = this.getKeyWordIndex(keyWord, preIndex);
        if (index < 0) {
            return;
        }

        let numLength = this.getNumLength(keyWord, index);
        if (numLength < 0) {
            return;
        }

        let avNum = this.res.body.substring(index, index + keyWord.length + numLength);
        avNum = keyWord + '-' + avNum.slice(-3);

        let hasNum = _.findIndex(this.avNums, num => avNum === num);
        if (hasNum < 0) {
            this.avNums.push(avNum);
        }

        this.getAvNums(keyWord, index + 1);
    }

    getNumLength(keyWord, index) {
        let numLength = 3;

        let body = this.res.body;

        let nextLetter = body.substring(index + keyWord.length, index + keyWord.length + 1);

        if (nextLetter !== '-' && Number.isNaN(parseInt(nextLetter))) {
            return -1;
        }

        if (body.substring(index + keyWord.length, index + keyWord.length + 1) === '-') {
            numLength = 4;
        }

        return numLength;
    }

    getKeyWordIndex(text, preIndex) {
        let body = this.res.body;

        let index = body.indexOf(text, preIndex);

        if (index < 0) {
            index = body.indexOf(text.toLowerCase(), preIndex)
        }

        return index;
    }
}

class CrawlerHtmlBuilder {

    constructor() {

    }

    buildTable(linkCollection) {
        let html = '';

        html += '<table>';

        _.each(linkCollection, (link) => {
            html += '<tr>';

            html += this.buildtds(link);

            html += '</tr>';
        });

        html += '</table>';
        html += '<br>';

        return html;
    }

    buildTds(link) {
        let html = '';
        html += `
                    <td>${link.publishedTime}</td>
                    <td><a href='${link.url}'>${link.text}</a></td>
                    <td><span style=''>${link.avNums.join(",")}</span></td>
                 `;
        return html;
    }

    buildLink(link) {
        let html = '';

        html = `
                <p>
                    <span>${link.publishedTime}</span>
                    <a style='margin-left:10px;width:600px;display: inline-block;' 
                        target="_blank" href='${link.url}'>${link.text}
                    </a>
                    <span>${link.avNums.join(",")}</span>
                </p>
                `;

        return html;
    }
}

class CrawlerFactory {

    static create(handler) {
        return new Crawler({
            maxConnections: 10,
            rateLimit: 1000,
            proxy: 'http://localhost:1080',
            callback: this.callback.call(null).bind(handler)
        });
    }

    static queues(opts) {
        return new Promise((resolve) => {
            let crawler = this.create(opts.handler);
            Object.assign(crawler.options, opts);

            crawler.queue(opts.list);

            crawler.on('drain', () => {
                resolve(crawler.options);
            });
        });
    }

    static queue(opts) {
        return new Promise((resolve) => {
            let crawler = this.create(resolve);
            Object.assign(crawler.options, opts);

            crawler.queue({
                uri: opts.uri
            });
        });
    }

    static callback() {
        return function (error, res, done) {
            if (error) {
                console.log(error);
            } else {
                this.call(null, res);
            }
            done();
        };
    }
}

let app = new CrawlerApplication();
app.start();
'use strict';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    billName: '',
    merchantCode: '',
    billNumber: '',
    billType: '',
    dpMin: '10',
    dpMax: '19',
    runCount: 1,
    counter: 0,
    running: false,
    paid: '0.00',
    error: null,
    start: null,
    end: null,
    interrupted: false,
  }, () => {});

  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
      chrome.declarativeContent.onPageChanged.addRules([{
        conditions: [
            new chrome.declarativeContent.PageStateMatcher({
              pageUrl: { hostEquals: 'www.ppshk.com' },
            }),
        ],
        actions: [
            new chrome.declarativeContent.ShowPageAction(),
        ]
      }]);
    });
});

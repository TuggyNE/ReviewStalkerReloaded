// ==UserScript==
// @name        Review Stalker Reloaded
// @namespace   com.tuggy.nathan
// @description Reloads specified Stack Exchange review pages, opening tasks as they show up
// @include     *://*.stackexchange.com/review*
// @include     /^https?://[^\.]*\.?stackoverflow\.com/review/
// @include     /^https?://[^\.]*\.?serverfault\.com/review/
// @include     /^https?://[^\.]*\.?superuser\.com/review/
// @include     /^https?://[^\.]*\.?askubuntu\.com/review/
// @include     /^https?://[^\.]*\.?mathoverflow\.net/review/
// @include     *://stackapps.net/review/*
// @version     1.5.22
// @grant       GM_openInTab
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_getResourceURL
// @grant       GM_info
// @resource    icon lens.png
// ==/UserScript==
const HrefBlankFavicon = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const LDomNoChildMeta = ["stackapps.net", "meta.stackexchange.com", "stackoverflow.com", "meta.stackoverflow.com"];
const NamTempBase = "__RSR_TEMP__";
// *** Change these millisecond intervals if desired ***
const MsiRoundReload = 5 * 60 * 1000, MsiReloadInQueue = 15 * 1000, MsiReloadStale = 60 * 60 * 1000;
// *** Change these navigation counts if desired ***
const NNavLoadMeta = 12, NTotalNavRecycleTab = 500;

var LDomSites = GM_getValue("LDomSites", "").split(",");

var NNavLoad = GM_getValue("NNavLoad", 1);
var MsiReload = Math.max(MsiRoundReload / LDomSites.length, MsiReloadInQueue);

var DomLoadStarted = GM_getValue("DomLoadStarted", "");
GM_setValue("DomLoadStarted", "");          // Should be empty most of the time

var BInQueue = /\/review\/.+/.test(location.href);
var DomMain = location.hostname, BDomInL = LDomSites.indexOf(DomMain) > -1;
function BHasChildMeta(Dom) {
  return LDomNoChildMeta.indexOf(Dom) === -1;
}
var BChildMeta = BHasChildMeta(DomMain) && DomMain.startsWith("meta.");
if (BChildMeta) { DomMain = DomMain.substring("meta.".length); }
function CheckNextPage() {
  var BRecycleTab = history.length >= NTotalNavRecycleTab && NTotalNavRecycleTab != -1;
  var i = LDomSites.indexOf(DomMain) + 1, DomNext = LDomSites[i % LDomSites.length];
  if (window.name.startsWith(NamTempBase)) {
    window.close();
    return;
  }
  if (LDomSites.length === 0) {
    // Nowhere to go
    return;
  }
  if (i >= LDomSites.length) {
    NNavLoad = (NNavLoad % NNavLoadMeta) + 1;
    GM_setValue("NNavLoad", NNavLoad);
  }
  if (NNavLoad >= NNavLoadMeta && BHasChildMeta(DomNext)) {
    DomNext = "meta." + DomNext;
  }
  var HrefNext = location.protocol + "//" + DomNext + "/review";
  //console.log("Next page is " + HrefNext + " at " + NNavLoad + "/" + NNavLoadMeta);
  
  if (BRecycleTab) {
    GM_setValue("DomLoadStarted", DomMain);
    GM_openInTab(HrefNext);
    window.close();
  }
  else {
    GM_setValue("DomLoadStarted", DomMain);
    location.assign(HrefNext);
  }
}

var HrefOriginalFavicon;
function SetFavicon(HrefIcon) {
  var NlLinkIcon = document.querySelectorAll("link[rel*='icon']");
  for (let N of NlLinkIcon) {
    if (!HrefOriginalFavicon) HrefOriginalFavicon = N.href;
    // Remove even the mobile stuff; no, that doesn't get replaced yet
    N.remove();
  }
  var ElemLinkIcon = document.createElement("link");
  ElemLinkIcon.rel = "icon";
  ElemLinkIcon.type = "image/x-icon";
  ElemLinkIcon.href = HrefIcon;
  document.head.appendChild(ElemLinkIcon);
}

function BCapped(ElemInstr) {
  return ElemInstr && ElemInstr.textContent.startsWith("Thank you for reviewing ");
}
function BEmpty(ElemInstr) {
  return ElemInstr && ElemInstr.textContent.startsWith("This queue has been cleared!");
}
function BLoading() {
  return !!document.querySelector(".review-actions .ajax-loader");
}

var BPaused = false, TitleBase = document.title, TmrQueueStatus, DtFirstLoaded = new Date();
function CheckQueueStatus() {
  let status = document.querySelector("div.review-status");
  if (status) {
    document.title = TitleBase;
    BPaused = true;
  }
  else {
    let instr = document.querySelector("span.review-instructions.infobox");
    if (BCapped(instr)) {
      setTimeout(function () { CheckNextPage(); }, 5 * 1000);
      clearInterval(TmrQueueStatus);
    }
    else if (BLoading()) {
      document.title = "… " + TitleBase;
      BPaused = true;
    }
    else if (BEmpty(instr)) {
      document.title = "∅ " + TitleBase;
      SetFavicon(HrefBlankFavicon);
      BPaused = false;
    }
    else if ((new Date()).valueOf() - DtFirstLoaded.valueOf() < MsiReloadStale) {
      document.title = "🔎 " + TitleBase;
      SetFavicon(HrefOriginalFavicon);
      BPaused = true;
    }
    else {
      // Let an aged-out review item go; if it comes back, that's fine
      BPaused = false;
    }
  }
}

var NlNumAvailable = document.querySelectorAll(".dashboard-count:not(.dashboard-faded) > .dashboard-num");
function GetLHrefToOpen() {
  var LHref = [];
  for (let NNumAvailable of NlNumAvailable) {
    let SNumAvailable = NNumAvailable.title;
    if (Number.parseInt(SNumAvailable) > 0) {
      let NLnkAvailable = NNumAvailable.parentNode.parentNode.querySelector(".dashboard-title > a");
      LHref.push(NLnkAvailable.href);
    }
  }
  return LHref;
}

var ElemHeader, ElemMetaLoadProgress;
function CreateElemMetaLoadProgress() {
  ElemMetaLoadProgress = document.createElement("span");
  
  ElemMetaLoadProgress.style.cssFloat = "right";
  ElemMetaLoadProgress.style.marginTop = "1em";
  ElemMetaLoadProgress.style.fontSize = "0.85em";
  ElemMetaLoadProgress.textContent = GM_info.script.name + " v" + GM_info.script.version;
  ElemMetaLoadProgress.textContent += "; meta load: " + NNavLoad + "/" + NNavLoadMeta;
  if (NTotalNavRecycleTab != -1) ElemMetaLoadProgress.textContent += "; tab recycle: " + history.length + "/" + NTotalNavRecycleTab;
  
  ElemHeader = document.querySelector(".subheader.tools-rev");
  ElemHeader.appendChild(ElemMetaLoadProgress);
}

function AddSite(Dom) {
  if (BDomInL) return false;
  LDomSites.push(Dom);
  if (!LDomSites[0]) LDomSites = LDomSites.slice(1)
  let SLDomSitesNew = LDomSites.join(",");
  GM_setValue("LDomSites", SLDomSitesNew);
  return true;
}
function RemoveSite(Dom) {
  if (!BDomInL) return false;
  let i = LDomSites.indexOf(Dom);
  if (i > -1) {
    LDomSites.splice(i, 1);
    let SLDomSitesNew = LDomSites.join(",").replace(/^,|,,|,$/, '');
    GM_setValue("LDomSites", SLDomSitesNew);
    return true;
  }
  else {
    console.log("Unable to find site " + Dom + " to remove it in '" + LDomSites.join(",") + "'!");
    return false;
  }
}
function CheckSiteMembership(NQueueAvailable, ElemContainer, ElemStatus) {
  if (DomLoadStarted && DomMain != DomLoadStarted && RemoveSite(DomLoadStarted)) {
    // We didn't end up where we wanted, probably because it's gone
    ElemStatus.textContent += " — " + DomLoadStarted + " missing!";
    BPaused = true;
  } else
  if (NQueueAvailable > 0 && AddSite(DomMain)) {
    ElemStatus.textContent += " — site added!";
  }
  else if (0 === NQueueAvailable && RemoveSite(DomMain)) {
    ElemStatus.textContent += " — site removed!";
  }
  else if (!BDomInL) {
    ElemContainer.removeChild(ElemStatus);
    BPaused = true;
  }
}

var LHrefToOpen = [];
if (BInQueue) {
  if (1 === history.length) {
    window.name = NamTempBase + Math.round(Math.random() * 1000);
  }
  
  TitleBase = document.title.replace(/^Review /, "");
  TmrQueueStatus = setInterval(CheckQueueStatus, 0.25 * 1000);
}
else {
  SetFavicon(GM_getResourceURL("icon"));
  LHrefToOpen = GetLHrefToOpen();
  if (!BChildMeta) {
    CreateElemMetaLoadProgress();
    CheckSiteMembership(NlNumAvailable.length, ElemHeader, ElemMetaLoadProgress);
  }
}

function AddPauseButton(ElemContainer, ElemMarker) {
  var ElemPause = document.createElement("a");
  ElemPause.href = "#";
  ElemPause.style.cssFloat = "right";
  ElemPause.style.marginTop = "1em";
  ElemPause.style.marginLeft = "1em";
  ElemPause.textContent = BPaused ? "Resume" : "Pause";
  
  ElemPause.addEventListener("click", function (e) {
      BPaused = !BPaused;
      ElemPause.textContent = BPaused ? "Resume" : "Pause";
      if (e) e.preventDefault();
      return false;
    });
  if (ElemMarker.parentNode) ElemMarker.parentNode.insertBefore(ElemPause, ElemMarker);
}
if (LHrefToOpen.length > 0) {
  for (let i = BChildMeta ? 0 : 1; i < LHrefToOpen.length; i++) {
    GM_openInTab(LHrefToOpen[i]);
  }
  if (BChildMeta) {
    CheckNextPage();
  }
  else {
    location.href = LHrefToOpen[0];
  }
}
else {
  if (!BInQueue) {
    if (BChildMeta) {
      CheckNextPage();
    }
    else {
      AddPauseButton(ElemHeader, ElemMetaLoadProgress);
    }
  }
  
  let TryLoadNext = function() {
    if (!BPaused) {
      CheckNextPage();
    }
  }
  setInterval(TryLoadNext, BInQueue ? MsiReloadInQueue : MsiReload);
}
 
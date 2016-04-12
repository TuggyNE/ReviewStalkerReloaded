// ==UserScript==
// @name        Review Stalker Reloaded
// @namespace   com.tuggy.nathan
// @description Reloads specified Stack Exchange review pages, opening tasks as they show up
// @match       *://*.stackexchange.com/review*
// @include     *://*.stackoverflow.com/review*
// @include     *://*.serverfault.com/review*
// @include     *://*.superuser.com/review*
// @include     *://*.askubuntu.com/review*
// @include     *://*.mathoverflow.net/review*
// @include     *://*.stackapps.net/review*
// @version     1.3.09
// @grant       GM_openInTab
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_getResourceURL
// @grant       GM_info
// @resource    icon lens.png
// ==/UserScript==
const HrefBlankFavicon = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
// *** Change these intervals if desired ***
const MsiRoundReload = 5 * 60 * 1000, MsiReloadInQueue = 15 * 1000, MsiReloadStale = 60 * 60 * 1000;
const NNavLoadMeta = 60, NTotalNavRecycleTab = 500;

// *** Customize this! ***
const LDomSites = ["ell.stackexchange.com", "space.stackexchange.com", "rpg.stackexchange.com", "meta.stackexchange.com"];
// TODO: Make configurable at runtime

var NNavLoad = GM_getValue("NNavLoad", 1);
var MsiReload = Math.max(MsiRoundReload / LDomSites.length, MsiReloadInQueue);

var BInQueue = /\/review\/.+/.test(location.href);
function BIsMotherMeta(Dom) {
  // Hack, but while MSO is busy enough, SO's review queues are flat ridiculous with this script
  return Dom == "meta.stackexchange.com" || Dom == "meta.stackoverflow.com";
}
var DomMain = location.hostname;
var BMotherMeta = BIsMotherMeta(DomMain);
var BChildMeta = !BMotherMeta && DomMain.startsWith("meta.");
if (BChildMeta) { DomMain = DomMain.substring("meta.".length); }
var ElemHeader = document.querySelector(".subheader.tools-rev"), ElemMetaLoadProgress;
var LHrefToOpen = [];

var BRecycleTab = history.length >= NTotalNavRecycleTab && NTotalNavRecycleTab != -1;
function CheckNextPage() {
  var i = LDomSites.indexOf(DomMain) + 1, DomNext = LDomSites[i % LDomSites.length];
  if (i >= LDomSites.length) {
    NNavLoad = (NNavLoad % NNavLoadMeta) + 1;
    GM_setValue("NNavLoad", NNavLoad);
  }
  if (NNavLoad >= NNavLoadMeta && !BIsMotherMeta(DomNext)) {
    DomNext = "meta." + DomNext;
  }
  var HrefNext = location.protocol + "//" + DomNext + "/review";
  console.log("Next page is " + HrefNext + " at " + NNavLoad + "/" + NNavLoadMeta);
  
  if (BRecycleTab) {
    GM_openInTab(HrefNext);
    window.close();
  }
  else {
    location.assign(HrefNext);
  }
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
var BPaused = false, DtFirstLoaded = new Date();

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
var TitleBase = document.title;
if (BInQueue) {
  TitleBase = document.title.replace(/^Review /, "");
  var TmrFaviconTitleMarker = setInterval(function() {
    let status = document.querySelector("div.review-status");
    if (status) {
      document.title = TitleBase;
      clearInterval(TmrFaviconTitleMarker);
      BPaused = true;
    }
    else {
      let instr = document.querySelector("span.review-instructions.infobox");
      if (BCapped(instr)) {
        setTimeout(function () { CheckNextPage(); }, 5 * 1000);
        clearInterval(TmrFaviconTitleMarker);
      }
      else if (BLoading()) {
        document.title = "… " + TitleBase;
        BPaused = true;
      }
      else if (BEmpty(instr)) {
        document.title = "∅ " + TitleBase;
        SetFavicon(HrefBlankFavicon);
        BPaused = false;
        clearInterval(TmrFaviconTitleMarker);
        //console.log("Unpausing because " + document.location.href + " is empty.");
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
  }, 0.25 * 1000);
}
else {
  SetFavicon(GM_getResourceURL("icon"));
  
  if (!BChildMeta && !BInQueue) {
    ElemMetaLoadProgress = document.createElement("span");
    ElemMetaLoadProgress.style.cssFloat = "right";
    ElemMetaLoadProgress.style.marginTop = "1em";
    ElemMetaLoadProgress.style.fontSize = "0.85em";
    ElemMetaLoadProgress.textContent = GM_info.script.name + " v" + GM_info.script.version;
    ElemMetaLoadProgress.textContent += "; meta load: " + NNavLoad + "/" + NNavLoadMeta;
    if (NTotalNavRecycleTab != -1) ElemMetaLoadProgress.textContent += "; tab recycle: " + history.length + "/" + NTotalNavRecycleTab;
    
    // Comment out this next line to hide the note about next meta load time
    ElemHeader.appendChild(ElemMetaLoadProgress);
  }

  var NlNumAvailable = document.querySelectorAll(".dashboard-count:not(.dashboard-faded) > .dashboard-num");
  for (let NNumAvailable of NlNumAvailable) {
    let SNumAvailable = NNumAvailable.title;
    //console.log(SNumAvailable);
    if (Number.parseInt(SNumAvailable) > 0) {
      let NLnkAvailable = NNumAvailable.parentNode.parentNode.querySelector(".dashboard-title > a");
      //console.log("adding " + NLnkAvailable.href);
      LHrefToOpen.push(NLnkAvailable.href);
    }
  }
}

//console.log("MS: %d; Last: %d; %d | %d", (new Date()).valueOf(), MstLastMetaLoad, MstLastMetaLoad + MsiMetaLoad, (new Date()).valueOf() + MsiReload);
if (LHrefToOpen.length > 0) {
  for (let i = BChildMeta ? 0 : 1; i < LHrefToOpen.length; i++) {
    GM_openInTab(LHrefToOpen[i]);
  }
  if (!BChildMeta) {
    //console.log("navigating to " + LHrefToOpen[0]);
    location.href = LHrefToOpen[0];
  }
}
else if (!BChildMeta) {
  //console.log("Setting reload timeout");
  if (!BInQueue) {
    var ElemPause = document.createElement("a");
    ElemPause.href = "#";
    ElemPause.style.cssFloat = "right";
    ElemPause.style.marginTop = "1em";
    ElemPause.style.marginLeft = "1em";
    ElemPause.textContent = "Pause";
    if (ElemMetaLoadProgress) {
      ElemHeader.insertBefore(ElemPause, ElemMetaLoadProgress);
    } else {
      ElemHeader.appendChild(ElemPause);
    }
    ElemPause.addEventListener("click", function (e) {
        ElemPause.textContent = BPaused ? "Pause" : "Resume"
        BPaused = !BPaused;
        if (e) e.preventDefault();
        return false;
      });
  }
  
  function LoadNext() {
    if (BPaused) {
      //document.title = "\u258C\u258C" + TitleBase;
    }
    else {
      // if (BInQueue && !confirm(document.location.href + " no longer has anything. Leave?")) {
        // clearInterval(TmrLoad);
        // return;
      // }
      CheckNextPage();
    }
  }
  setInterval(LoadNext, BInQueue ? MsiReloadInQueue : MsiReload);
}
if (BChildMeta && !BInQueue) {
  //console.log("Loading main");
  CheckNextPage();
}
 
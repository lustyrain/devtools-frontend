// Copyright 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Common from '../common/common.js';  // eslint-disable-line no-unused-vars
import * as Formatter from '../formatter/formatter.js';
import * as i18n from '../i18n/i18n.js';
import * as Persistence from '../persistence/persistence.js';
import * as SourceFrame from '../source_frame/source_frame.js';  // eslint-disable-line no-unused-vars
import * as UI from '../ui/ui.js';
import * as Workspace from '../workspace/workspace.js';  // eslint-disable-line no-unused-vars

import {EditorAction, Events, SourcesView} from './SourcesView.js';  // eslint-disable-line no-unused-vars

export const UIStrings = {
  /**
  *@description Title of the format button in the Sources panel
  *@example {file name} PH1
  */
  formatS: 'Format {PH1}',
  /**
  *@description Tooltip text that appears when hovering over the largeicon pretty print button in the Inplace Formatter Editor Action of the Sources panel
  */
  format: 'Format',
};
const str_ = i18n.i18n.registerUIStrings('sources/InplaceFormatterEditorAction.js', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
/**
 * @implements {EditorAction}
 */
export class InplaceFormatterEditorAction {
  constructor() {
    /** @type {!UI.Toolbar.ToolbarButton} */
    this._button;
    /** @type {!SourcesView} */
    this._sourcesView;
  }
  /**
   * @param {!Common.EventTarget.EventTargetEvent} event
   */
  _editorSelected(event) {
    const uiSourceCode = /** @type {!Workspace.UISourceCode.UISourceCode} */ (event.data);
    this._updateButton(uiSourceCode);
  }

  /**
   * @param {!Common.EventTarget.EventTargetEvent} event
   */
  _editorClosed(event) {
    const wasSelected = /** @type {boolean} */ (event.data.wasSelected);
    if (wasSelected) {
      this._updateButton(null);
    }
  }

  /**
   * @param {?Workspace.UISourceCode.UISourceCode} uiSourceCode
   */
  _updateButton(uiSourceCode) {
    const isFormattable = this._isFormattable(uiSourceCode);
    this._button.element.classList.toggle('hidden', !isFormattable);
    if (uiSourceCode && isFormattable) {
      this._button.setTitle(i18nString(UIStrings.formatS, {PH1: uiSourceCode.name()}));
    }
  }

  /**
   * @override
   * @param {!SourcesView} sourcesView
   * @return {!UI.Toolbar.ToolbarButton}
   */
  button(sourcesView) {
    if (this._button) {
      return this._button;
    }

    this._sourcesView = sourcesView;
    this._sourcesView.addEventListener(Events.EditorSelected, this._editorSelected.bind(this));
    this._sourcesView.addEventListener(Events.EditorClosed, this._editorClosed.bind(this));

    this._button = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.format), 'largeicon-pretty-print');
    this._button.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this._formatSourceInPlace, this);
    this._updateButton(sourcesView.currentUISourceCode());

    return this._button;
  }

  /**
   * @param {?Workspace.UISourceCode.UISourceCode} uiSourceCode
   * @return {boolean}
   */
  _isFormattable(uiSourceCode) {
    if (!uiSourceCode) {
      return false;
    }
    if (uiSourceCode.project().canSetFileContent()) {
      return true;
    }
    if (Persistence.Persistence.PersistenceImpl.instance().binding(uiSourceCode)) {
      return true;
    }
    return uiSourceCode.contentType().isStyleSheet();
  }

  /**
   * @param {!Common.EventTarget.EventTargetEvent} event
   */
  _formatSourceInPlace(event) {
    const uiSourceCode = this._sourcesView.currentUISourceCode();
    if (!uiSourceCode || !this._isFormattable(uiSourceCode)) {
      return;
    }

    if (uiSourceCode.isDirty()) {
      this._contentLoaded(uiSourceCode, uiSourceCode.workingCopy());
    } else {
      uiSourceCode.requestContent().then(deferredContent => {
        this._contentLoaded(
            /** @type {!Workspace.UISourceCode.UISourceCode} */ (uiSourceCode), deferredContent.content || '');
      });
    }
  }

  /**
   * @param {!Workspace.UISourceCode.UISourceCode} uiSourceCode
   * @param {string} content
   */
  _contentLoaded(uiSourceCode, content) {
    const highlighterType = uiSourceCode.mimeType();
    Formatter.ScriptFormatter.FormatterInterface.format(
        uiSourceCode.contentType(), highlighterType, content, async (formattedContent, formatterMapping) => {
          this._formattingComplete(uiSourceCode, formattedContent, formatterMapping);
        });
  }

  /**
   * Post-format callback
   * @param {!Workspace.UISourceCode.UISourceCode} uiSourceCode
   * @param {string} formattedContent
   * @param {!Formatter.ScriptFormatter.FormatterSourceMapping} formatterMapping
   */
  _formattingComplete(uiSourceCode, formattedContent, formatterMapping) {
    if (uiSourceCode.workingCopy() === formattedContent) {
      return;
    }
    const sourceFrame =
        /** @type {!SourceFrame.SourceFrame.SourceFrameImpl} */ (this._sourcesView.viewForFile(uiSourceCode));
    let start = [0, 0];
    if (sourceFrame) {
      const selection = sourceFrame.selection();
      start = formatterMapping.originalToFormatted(selection.startLine, selection.startColumn);
    }
    uiSourceCode.setWorkingCopy(formattedContent);

    this._sourcesView.showSourceLocation(uiSourceCode, start[0], start[1]);
  }
}

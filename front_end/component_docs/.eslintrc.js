// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

module.exports = {
  overrides: [{
    'files': ['*.ts'],
    'rules': {
      // This makes the component doc examples very verbose and doesn't add
      // anything, so we leave return types to the developer within the
      // component_docs folder.
      '@typescript-eslint/explicit-function-return-type': 0,
    }
  }]
};

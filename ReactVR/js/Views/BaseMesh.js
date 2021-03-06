/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import RCTBaseView from './BaseView';

import extractURL from '../Utils/extractURL';
import merge from '../Utils/merge';
import * as OVRUI from 'ovrui';
import * as THREE from 'three';
import * as Yoga from '../Utils/Yoga.bundle';

import type {GuiSys} from 'ovrui';
import type {Geometry, Texture, Material} from 'three';
import type {ReactNativeContext} from '../ReactNativeContext';

type ResourceSpecifier = void | null | string | {uri: string};

export default class RCTBaseMesh extends RCTBaseView {
  _color: ?number;
  _lit: boolean;
  _wireframe: boolean;
  _textureURL: null | string;
  _loadingURL: null | string;
  _texture: null | Texture;
  _litMaterial: Material;
  _unlitMaterial: Material;
  mesh: any;
  _geometry: any;
  _rnctx: ReactNativeContext;

  constructor(guiSys: GuiSys, rnctx: ReactNativeContext) {
    super();

    this._lit = false;
    this._wireframe = false;
    this._textureURL = null;
    this._loadingURL = null;
    this._texture = null; // Cache for THREE Texture
    this._litMaterial = new THREE.MeshPhongMaterial({color: 0xffffff}); // THREE Material to use when texture or color used, lit === true
    this._unlitMaterial = new THREE.MeshBasicMaterial({color: 0xffffff}); // THREE Material to use when texture or color used, lit === false
    this._rnctx = rnctx;

    this.mesh = null;
    this.view = new OVRUI.UIView(guiSys);

    Object.defineProperty(
      this.style,
      'opacity',
      ({
        configurable: true,
        set: value => {
          if (value === null) {
            this._litMaterial.opacity = 1;
            this._unlitMaterial.opacity = 1;
            this._litMaterial.transparent = false;
            this._unlitMaterial.transparent = false;
          } else {
            this._litMaterial.opacity = value;
            this._unlitMaterial.opacity = value;
            this._litMaterial.transparent = value < 1;
            this._unlitMaterial.transparent = value < 1;
          }
        },
      }: Object)
    );

    Object.defineProperty(
      this.props,
      'lit',
      ({
        set: this._setLit.bind(this),
      }: Object)
    );

    Object.defineProperty(
      this.props,
      'wireframe',
      ({
        set: this._setWireframe.bind(this),
      }: Object)
    );

    Object.defineProperty(
      this.props,
      'texture',
      ({
        set: this._setTexture.bind(this),
      }: Object)
    );

    Object.defineProperty(
      this.style,
      'color',
      ({
        set: this._setColor.bind(this),
      }: Object)
    );
  }

  _setColor(color: ?number) {
    this._color = color;
    if (color == null) {
      this._litMaterial.color.setHex(0xffffff);
      this._unlitMaterial.color.setHex(0xffffff);
    } else {
      this._litMaterial.color.setHex(color);
      this._unlitMaterial.color.setHex(color);
    }
  }

  _setTexture(value: ResourceSpecifier) {
    if (!value) {
      if (this._texture) {
        this._texture = null;
        if (this._textureURL) {
          // Release the reference to the original texture
          this._rnctx.TextureManager.removeReference(this._textureURL);
          this._textureURL = null;
        }
      }
      // Remove texture from textured materials
      this._litMaterial.map = null;
      this._unlitMaterial.map = null;
      this._litMaterial.needsUpdate = true;
      this._unlitMaterial.needsUpdate = true;
      return;
    }
    const url = extractURL(value);
    if (!url) {
      throw new Error('Invalid value for "texture" property: ' + JSON.stringify(value));
    }
    this._loadingURL = url;
    const manager = this._rnctx.TextureManager;
    manager.addReference(url);
    manager
      .getTextureForURL(url)
      .then(
        texture => {
          if (url !== this._loadingURL) {
            // We've started to load another texture since this request began
            manager.removeReference(url);
            return;
          }
          this._loadingURL = null;
          if (this._textureURL) {
            manager.removeReference(this._textureURL);
          }
          this._texture = texture;
          this._texture.needsUpdate = true;
          this._textureURL = url;
          // TODO: Consider providing props on BaseMesh to control these as well
          this._litMaterial.map = this._texture;
          this._unlitMaterial.map = this._texture;
          this._litMaterial.needsUpdate = true;
          this._unlitMaterial.needsUpdate = true;
        },
        err => {
          manager.removeReference(url);
          this._loadingURL = null;
          console.error(err);
        }
      )
      .catch(err => {
        console.error(err);
      });
  }

  _setLit(flag: boolean) {
    this._lit = flag;
    const mat = flag ? this._litMaterial : this._unlitMaterial;
    if (this.mesh) {
      this.mesh.material = mat;
    }
  }

  _setWireframe(flag: boolean) {
    this._wireframe = flag;
    this._litMaterial.wireframe = flag;
    this._unlitMaterial.wireframe = flag;
  }

  _setGeometry(geometry: Geometry) {
    if (!this.mesh) {
      this.mesh = new THREE.Mesh(geometry, this._lit ? this._litMaterial : this._unlitMaterial);
      this.view.add(this.mesh);
    } else {
      this.mesh.geometry = geometry;
    }
  }

  presentLayout() {
    super.presentLayout();
    if (this.mesh && this.mesh.geometry) {
      this.mesh.geometry.visible = this.YGNode.getDisplay() !== Yoga.DISPLAY_NONE;
    }
  }

  dispose() {
    if (this._texture) {
      this._texture = null;
      if (this._textureURL) {
        // Release the reference to the original texture
        this._rnctx.TextureManager.removeReference(this._textureURL);
        this._textureURL = null;
      }
    }
    this._litMaterial.dispose();
    this._unlitMaterial.dispose();
    super.dispose();
    this._geometry = null;
    this.mesh = null;
  }

  static describe() {
    return merge(super.describe(), {
      // register the properties sent from react to runtime
      NativeProps: {
        lit: 'boolean',
        texture: 'object',
        wireframe: 'boolean',
      },
    });
  }
}

// *****************************************************************************
// Copyright (C) 2020 TypeFox and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable, interfaces, postConstruct, inject } from '@theia/core/shared/inversify';
import { TreeNode } from '@theia/core/lib/browser';
import { SourceTreeWidget } from '@theia/core/lib/browser/source-tree';
import { VSXExtensionsSource, VSXExtensionsSourceOptions } from './vsx-extensions-source';
import { nls } from '@theia/core/lib/common/nls';
import { BadgeWidget } from '@theia/core/lib/browser/view-container';
import { Emitter } from '@theia/core/lib/common';

@injectable()
export class VSXExtensionsWidgetOptions extends VSXExtensionsSourceOptions {
    title?: string;
}

export const generateExtensionWidgetId = (widgetId: string): string => VSXExtensionsWidget.ID + ':' + widgetId;

@injectable()
export class VSXExtensionsWidget extends SourceTreeWidget implements BadgeWidget {

    static ID = 'vsx-extensions';

    static createWidget(parent: interfaces.Container, options: VSXExtensionsWidgetOptions): VSXExtensionsWidget {
        const child = SourceTreeWidget.createContainer(parent, {
            virtualized: false,
            scrollIfActive: true
        });
        child.bind(VSXExtensionsSourceOptions).toConstantValue(options);
        child.bind(VSXExtensionsSource).toSelf();
        child.unbind(SourceTreeWidget);
        child.bind(VSXExtensionsWidgetOptions).toConstantValue(options);
        child.bind(VSXExtensionsWidget).toSelf();
        return child.get(VSXExtensionsWidget);
    }

    @inject(VSXExtensionsWidgetOptions)
    protected readonly options: VSXExtensionsWidgetOptions;

    @inject(VSXExtensionsSource)
    protected readonly extensionsSource: VSXExtensionsSource;

    @postConstruct()
    protected override init(): void {
        super.init();
        this.addClass('theia-vsx-extensions');

        this.id = generateExtensionWidgetId(this.options.id);

        this.toDispose.push(this.extensionsSource);
        this.source = this.extensionsSource;

        this.computeTitle();

        this.toDispose.push(this.source.onDidChange(() => {
            this.computeTitle();
        }));
    }

    private _badgeNode: Node | undefined = undefined;
    get badgeNode(): Node | undefined {
        return this._badgeNode;
    }

    set badgeNode(node: Node | undefined) {
        this._badgeNode = node;
        this.onDidChangeBadge.fire();
    }

    public onDidChangeBadge: Emitter<void> = new Emitter<void>();

    protected async computeTitle(): Promise<void> {
        let label: string;
        switch (this.options.id) {
            case VSXExtensionsSourceOptions.INSTALLED:
                label = nls.localizeByDefault('Installed');
                break;
            case VSXExtensionsSourceOptions.BUILT_IN:
                label = nls.localizeByDefault('Built-in');
                break;
            case VSXExtensionsSourceOptions.RECOMMENDED:
                label = nls.localizeByDefault('Recommended');
                break;
            case VSXExtensionsSourceOptions.SEARCH_RESULT:
                label = nls.localize('theia/vsx-registry/openVSX', 'Open VSX Registry');
                break;
            default:
                label = '';
        }
        const title = `${label}`;
        this.title.label = title;
        this.title.caption = title;

        const countLabel = await this.resolveCountLabel();
        this.updateBadge(`${countLabel}`);
    }

    protected updateBadge(innerText: string): void {
        if (innerText.length === 0) {
            this.badgeNode = undefined;
            return;
        }

        const badge = document.createElement('span');
        badge.classList.add('notification-count');
        badge.innerText = innerText;

        const badgeContainer = document.createElement('div');
        badgeContainer.classList.add('notification-count-container');
        badgeContainer.appendChild(badge);
        this.badgeNode = badgeContainer;
    }

    protected async resolveCountLabel(): Promise<string> {
        let label = '';
        if (this.options.id !== VSXExtensionsSourceOptions.SEARCH_RESULT) {
            const elements = await this.source?.getElements() || [];
            label = `${[...elements].length}`;
        }
        return label;
    }

    protected override tapNode(node?: TreeNode): void {
        super.tapNode(node);
        this.model.openNode(node);
    }

    protected override handleDblClickEvent(): void {
        // Don't open the editor view on a double click.
    }
}

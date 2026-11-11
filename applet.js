const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const Util = imports.misc.util;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

class MacAppMenuApplet extends Applet.Applet {
    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.orientation = orientation;

        this.actor.style_class = 'mac-applet-root';
        this.actor.reactive = true;
        this.actor.track_hover = false;

        this.tracker = Cinnamon.WindowTracker.get_default();
        this.activeWindow = null;

        this.box = new St.BoxLayout({
            name: 'macAppMenuBox',
            reactive: true,
            track_hover: false
        });
        this.actor.add_actor(this.box);

        this.menuManager = new PopupMenu.PopupMenuManager(this);

        this._buildMenuBar();

        this.focusSignal = global.display.connect('notify::focus-window', () => {
            this._updateActiveApp();
        });

        this._updateActiveApp();
    }

    _buildMenuBar() {
        // 1. App Title Menu
        this.appBtn = this._createMenuButton("Finder");
        this.appMenu = this._createAlignedMenu(this.appBtn, () => this._populateAppMenu());
        this.appBtn.connect('clicked', () => this.appMenu.toggle(false));
        this.box.add_actor(this.appBtn);

        // 2. Edit Menu
        this.editBtn = this._createMenuButton("Edit");
        this.editMenu = this._createAlignedMenu(this.editBtn, () => this._populateEditMenu());
        this.editBtn.connect('clicked', () => this.editMenu.toggle(false));
        this.box.add_actor(this.editBtn);

        // 3. View Menu
        this.viewBtn = this._createMenuButton("View");
        this.viewMenu = this._createAlignedMenu(this.viewBtn, () => this._populateViewMenu());
        this.viewBtn.connect('clicked', () => this.viewMenu.toggle(false));
        this.box.add_actor(this.viewBtn);

        // 4. Window Menu
        this.winBtn = this._createMenuButton("Window");
        this.winMenu = this._createAlignedMenu(this.winBtn, () => this._populateWindowMenu());
        this.winBtn.connect('clicked', () => this.winMenu.toggle(false));
        this.box.add_actor(this.winBtn);

        // 5. Help Menu
        this.helpBtn = this._createMenuButton("Help");
        this.helpMenu = this._createAlignedMenu(this.helpBtn, () => this._populateHelpMenu());
        this.helpBtn.connect('clicked', () => this.helpMenu.toggle(false));
        this.box.add_actor(this.helpBtn);
    }

    _createMenuButton(initialLabel) {
        let label = new St.Label({
            text: initialLabel,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'padding-left: 9px; padding-right: 9px; font-weight: normal;'
        });

        let btn = new St.Button({
            style_class: 'applet-box',
            reactive: true,
            can_focus: true,
            track_hover: true
        });
        btn.set_child(label);
        return btn;
    }

    _createAlignedMenu(launcherBtn, populateFn) {
    let menu = new PopupMenu.PopupMenu(launcherBtn, this.orientation);
    menu.actor.add_style_class_name('applet-popup-menu');
    menu.actor.add_style_class_name('mac-flush-popup');

    if (Main.uiGroup.add_actor) {
        Main.uiGroup.add_actor(menu.actor);
    } else {
        Main.uiGroup.add_child(menu.actor);
    }
    menu.actor.hide();

    // Keep Cinnamon's own Y placement, but force X to the button's left edge
    if (typeof menu._calculatePosition === 'function') {
        let origCalc = menu._calculatePosition.bind(menu);
        menu._calculatePosition = (...args) => {
            let result = origCalc(...args);
            let [bx] = launcherBtn.get_transformed_position();
            let x = Math.round(bx);

            let monitor = Main.layoutManager.findMonitorForActor(launcherBtn);
            if (monitor) {
                let w = menu.actor.width;
                x = Math.min(x, monitor.x + monitor.width - w);
                x = Math.max(x, monitor.x);
            }
            result[0] = x;
            return result;
        };
    }

    menu.connect('open-state-changed', (m, open) => {
        if (open) {
            this._syncCurrentState();
            populateFn();
        }
    });

    this.menuManager.addMenu(menu);
    return menu;
}

    _syncCurrentState() {
        let win = global.display.focus_window;
        if (!win || win.is_override_redirect() || win.window_type === Meta.WindowType.DESKTOP) {
            this.activeWindow = null;
        } else {
            this.activeWindow = win;
        }
    }

    _updateActiveApp() {
        try {
            this._syncCurrentState();
            let win = this.activeWindow;

            if (!win) {
                this._setAppLabel("Finder");
                return;
            }

            let app = this.tracker.get_window_app(win);
            if (app) {
                this._setAppLabel(app.get_name());
            } else {
                let title = win.get_title();
                this._setAppLabel(title ? title.substring(0, 20) : "Application");
            }
        } catch (err) {
            global.logError("MacAppMenu Error: " + err);
        }
    }

    _setAppLabel(text) {
        let labelActor = this.appBtn.get_child();
        if (labelActor) {
            labelActor.set_text(text);
            labelActor.set_style('padding-left: 9px; padding-right: 9px; font-weight: bold;');
        }
    }

    _populateAppMenu() {
        this.appMenu.removeAll();
        let win = this.activeWindow;
        let app = win ? this.tracker.get_window_app(win) : null;
        let appName = app ? app.get_name() : (win ? win.get_title() : "Desktop");

        if (!win) {
            this.appMenu.addMenuItem(new PopupMenu.PopupMenuItem("No Active App", { reactive: false }));
            return;
        }

        this._addItem(this.appMenu, "Hide " + appName, () => win.minimize());
        this._addItem(this.appMenu, "Close Window", () => win.delete(global.get_current_time()));
        if (app) {
            this._addItem(this.appMenu, "Quit " + appName, () => {
                let windows = app.get_windows();
                windows.forEach(w => w.delete(global.get_current_time()));
            });
        }
    }

    _populateEditMenu() {
        this.editMenu.removeAll();
        this._addItem(this.editMenu, "Undo", () => this._sendKey("ctrl+z"));
        this._addItem(this.editMenu, "Redo", () => this._sendKey("ctrl+y"));
        this.editMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addItem(this.editMenu, "Cut", () => this._sendKey("ctrl+x"));
        this._addItem(this.editMenu, "Copy", () => this._sendKey("ctrl+c"));
        this._addItem(this.editMenu, "Paste", () => this._sendKey("ctrl+v"));
        this.editMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addItem(this.editMenu, "Select All", () => this._sendKey("ctrl+a"));
    }

    _populateViewMenu() {
        this.viewMenu.removeAll();
        let win = this.activeWindow;
        if (!win) {
            this.viewMenu.addMenuItem(new PopupMenu.PopupMenuItem("No Active Window", { reactive: false }));
            return;
        }

        let isFull = win.is_fullscreen ? win.is_fullscreen() : false;
        this._addItem(this.viewMenu, isFull ? "Exit Fullscreen" : "Enter Fullscreen", () => {
            if (isFull) win.unmake_fullscreen(); else win.make_fullscreen();
        });

        let isMax = win.get_maximized ? win.get_maximized() : 0;
        this._addItem(this.viewMenu, isMax ? "Restore Size" : "Maximize", () => {
            if (isMax) win.unmaximize(Meta.MaximizeFlags.BOTH); else win.maximize(Meta.MaximizeFlags.BOTH);
        });

        this._addItem(this.viewMenu, "Minimize", () => win.minimize());
        this.viewMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._addItem(this.viewMenu, "Tile Left", () => this._tileWindow(win, 'left'));
        this._addItem(this.viewMenu, "Tile Right", () => this._tileWindow(win, 'right'));
        this._addItem(this.viewMenu, "Tile Top", () => this._tileWindow(win, 'top'));
        this._addItem(this.viewMenu, "Tile Bottom", () => this._tileWindow(win, 'bottom'));
    }

    _populateWindowMenu() {
        this.winMenu.removeAll();
        let win = this.activeWindow;
        let app = win ? this.tracker.get_window_app(win) : null;

        if (app) {
            let appWindows = app.get_windows();
            if (appWindows && appWindows.length > 0) {
                this._addItem(this.winMenu, "Bring All to Front", () => {
                    appWindows.forEach(w => w.activate(global.get_current_time()));
                });
                this.winMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                appWindows.forEach(w => {
                    let isCurrent = (win && w === win);
                    let wTitle = w.get_title() || "Untitled Window";
                    if (wTitle.length > 35) wTitle = wTitle.substring(0, 32) + "...";
                    let prefix = isCurrent ? "✓ " : "   ";

                    let wItem = new PopupMenu.PopupMenuItem(prefix + wTitle);
                    wItem.connect('activate', () => {
                        w.activate(global.get_current_time());
                    });
                    this.winMenu.addMenuItem(wItem);
                });
                return;
            }
        }

        if (win) {
            this.winMenu.addMenuItem(new PopupMenu.PopupMenuItem("✓ " + (win.get_title() || "Window")));
        } else {
            this.winMenu.addMenuItem(new PopupMenu.PopupMenuItem("No Windows Open", { reactive: false }));
        }
    }

    _populateHelpMenu() {
        this.helpMenu.removeAll();
        let win = this.activeWindow;
        let app = win ? this.tracker.get_window_app(win) : null;
        let appName = app ? app.get_name() : (win ? win.get_title() : "Desktop");

        let helpTarget = this._resolveHelpTarget(app, win);
        this._addItem(this.helpMenu, appName + " Help", () => {
            Util.spawnCommandLine(helpTarget);
        });
    }

    _addItem(menu, label, callback) {
        let item = new PopupMenu.PopupMenuItem(label);
        item.connect('activate', () => {
            try {
                callback();
            } catch (e) {
                global.logError(e);
            }
        });
        menu.addMenuItem(item);
    }

    _sendKey(combo) {
        Util.spawnCommandLine(`bash -c "sleep 0.15 && xdotool key --clearmodifiers ${combo}"`);
    }

    _tileWindow(win, direction) {
        let workArea = win.get_workspace().get_work_area_for_monitor(win.get_monitor());
        let x = workArea.x;
        let y = workArea.y;
        let w = workArea.width;
        let h = workArea.height;

        win.unmaximize(Meta.MaximizeFlags.BOTH);

        if (direction === 'left') {
            win.move_resize_frame(true, x, y, Math.floor(w / 2), h);
        } else if (direction === 'right') {
            win.move_resize_frame(true, x + Math.floor(w / 2), y, Math.floor(w / 2), h);
        } else if (direction === 'top') {
            win.move_resize_frame(true, x, y, w, Math.floor(h / 2));
        } else if (direction === 'bottom') {
            win.move_resize_frame(true, x, y + Math.floor(h / 2), w, Math.floor(h / 2));
        }
    }

    _resolveHelpTarget(app, win) {
        if (!app) return "xdg-open https://www.google.com";
        let id = app.get_id ? app.get_id() : "";
        let name = app.get_name().toLowerCase();

        if (id.includes("gnome") || id.includes("xed") || id.includes("nemo")) {
            let baseCmd = id.replace(".desktop", "");
            return `bash -c "yelp help:${baseCmd} || xdg-open https://google.com/search?q=${encodeURIComponent(name + ' linux help documentation')}"`;
        }

        return `xdg-open "https://www.google.com/search?q=${encodeURIComponent(name + ' manual documentation')}"`;
    }

    on_applet_removed_from_panel() {
        if (this.focusSignal) {
            global.display.disconnect(this.focusSignal);
            this.focusSignal = 0;
        }
        [this.appMenu, this.editMenu, this.viewMenu, this.winMenu, this.helpMenu].forEach(m => {
            if (m) m.destroy();
        });
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MacAppMenuApplet(orientation, panelHeight, instanceId);
}

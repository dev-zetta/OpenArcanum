import {Manager} from '../../agate/client/Gui';

export default function(server) {

  /*
    Seed your development database using your factories.
    This data will not be loaded in your tests.
  */

  // server.createList('post', 10);

  function componentToWidget(key, component, parent) {

    let widget = Object.assign({'id': key, /*'componentName': `gui-${component.type}`*/ }, component);
    widget.parent = parent;

    /*if (widget.position)
      widget.position = {'left': widget.position[0], 'top': widget.position[1]};

    if (widget.size)
      widget.size = {'width': widget.size[0], 'height': widget.size[1]};*/

    if (widget.events) {
      widget.events = Manager.objectToJson(widget.events);
    }

    if (widget.listeners) {
      widget.listeners = Manager.objectToJson(widget.listeners);
    }

    let components = widget.components;
    widget.components = null;
    let instance = server.create('gui-widget', widget, parent);

    if (components) {
      let instances = [];
      for (let key2 in components) {
        let component2 = components[key2];

        let childInstance = componentToWidget(key2, component2, instance);

        instances.push(childInstance);
      }

      //console.log(instance);
      instance.update('components', instances);
    }

    instance.save();
    return instance;
  }

  let components = Manager.loadComponents();
  for (let key in components) {
    let component = components[key];

    let instance = componentToWidget(key, component, null);

  }
}

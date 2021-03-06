import { css, CSSObject } from "@chakra-ui/css"
import {
  As,
  Dict,
  isEmptyObject,
  isString,
  isUndefined,
  runIfFn,
} from "@chakra-ui/utils"
import hoist from "hoist-non-react-statics"
import { ComponentType, forwardRef, memo, Ref } from "react"
import { getComponentStyles } from "./component"
import { useChakra } from "./hooks"
import jsx from "./jsx"
import {
  customShouldForwardProp,
  filterProps,
  removeStyleProps,
} from "./should-forward-prop"
import { ChakraComponent, Options } from "./system.types"
import { getDisplayName } from "./system.utils"

function createStyled<T extends As, P = {}>(
  component: T,
  options?: Options<T, P>,
) {
  return function (...interpolations: any[]) {
    const Styled = forwardRef(({ as, ...props }: any, ref: Ref<any>) => {
      const { theme, colorMode } = useChakra()
      let computedStyles: CSSObject = {}

      const propsWithTheme = { theme, colorMode, ...props }

      /**
       * Users can pass a base style to the component options, let's resolve it
       *
       * @example
       * const Button = chakra("button", {
       *  baseStyle: {
       *    margin: 4,
       *    color: "red.300"
       *  }
       * })
       */
      if (options?.baseStyle) {
        const baseStyleObject = runIfFn(options.baseStyle, propsWithTheme)
        const baseStyle = css(baseStyleObject)(theme)
        computedStyles = { ...computedStyles, ...baseStyle } as CSSObject
      }

      /**
       * Users can pass a theme key to reference styles in the theme, let's resolve it.
       * Styles will be read from `theme.components.<themeKey>`
       *
       * @example
       * const Button = chakra("button", {
       *  themeKey: "Button"
       * })
       */
      if (options) {
        const styles = getComponentStyles(propsWithTheme, options)
        computedStyles = { ...computedStyles, ...styles } as CSSObject
      }

      // Resolve each interpolation and add result to final style
      interpolations.forEach((interpolation) => {
        const style = runIfFn(interpolation, propsWithTheme)
        computedStyles = { ...computedStyles, ...style }
      })

      const element = as || component
      const isTag = isString(element)

      let computedProps: Dict = isTag ? filterProps(props) : { ...props }

      /**
       * Users can pass a html attributes to component options, let's resolve it.
       * Attributes will be passed to the underlying dom element
       *
       * @example
       * const Button = chakra("button", {
       *  attrs: {
       *    type: "submit"
       *  }
       * })
       */
      if (options?.attrs) {
        const attrsProps = runIfFn(options.attrs, propsWithTheme)
        computedProps = { ...computedProps, ...attrsProps }
      }

      if (!isTag) computedProps = removeStyleProps(computedProps)

      /**
       * Users can pass an option to control how props are forwarded
       *
       * @example
       * const Button = chakra("button", {
       *  attrs: props => ({
       *    type: "submit",
       *    disabled: props.isDisabled
       *  }),
       * shouldForwardProps: prop => prop !== "isDisabled"
       * })
       */
      if (options?.shouldForwardProp) {
        computedProps = customShouldForwardProp(
          options.shouldForwardProp,
          computedProps,
        )
      }

      // check if style is empty, we don't want to pass css prop to jsx if it's empty
      const isStyleEmpty = isEmptyObject(computedStyles)

      computedProps.css = isStyleEmpty
        ? runIfFn(computedProps.css, theme)
        : { ...computedStyles, ...runIfFn(computedProps.css, theme) }

      /**
       * This helps to prevent scenarios where no styles was passed
       * to the component but emotion generate a `css-0` className.
       */
      if (isEmptyObject(computedProps.css) || isUndefined(computedProps.css)) {
        delete computedProps.css
      }

      /**
       * Create the element using emotion's jsx, similar tocreateElement
       * but it allows us pass a css object as prop and it'll convert it to a className
       */
      return jsx(element, { ref, ...computedProps })
    })

    // Compute the display name of the final component
    Styled.displayName = getDisplayName(component)

    Styled.defaultProps = (component as any).defaultProps

    // [Optimization] users can pass a pure option to memoize this component
    const StyledComponent = options?.pure ? memo(Styled) : Styled

    // hoist all non-react statics attached to the `component` prop
    const Component = hoist(StyledComponent, component as ComponentType<any>)

    return Component as ChakraComponent<T, P>
  }
}

export default createStyled
